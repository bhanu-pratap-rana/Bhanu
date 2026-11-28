// Server-side guards around the model call. Two jobs:
//
// 1. A pre-gate: a request for code, a general task (poems, maths, weather,
//    translation) or a prompt-injection marker gets a fixed one-sentence
//    refusal without calling the model. It matches patterns, so paraphrases,
//    other languages and new tricks will get past it: it is defence in depth.
//    The system prompt (and the output filter in groq-stream.ts) remain the
//    real control; the pre-gate only saves a model call on the obvious cases.
// 2. Answer signatures: the browser sends earlier answers back as history, and
//    an assistant turn carries more weight with the model than a user turn. So
//    each answer is signed when it is served, and an assistant turn without a
//    valid, unexpired signature is dropped before the model sees it.
//
// Pure apart from node:crypto. The guard is tuned not to block a real
// question about his work (see chat-guard.test.ts, which pins every known
// near miss): when in doubt it lets the question through.

import { createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import {
  CUT_OFF_SUFFIX,
  SIGNATURE_PATTERN,
  SIGNED_ANSWER_CHARS,
  SIGNED_USER_CHARS,
  declineText,
} from "./chat-request";

export {
  ANSWER_SIGNATURE_SEPARATOR,
  SIGNED_ANSWER_CHARS,
  SIGNED_USER_CHARS,
} from "./chat-request";
import { jobDescriptionPrompt } from "./knowledge";
import { replyScript } from "./lang";

export type GuardReason = "injection" | "code" | "task";
export type GuardVerdict = { blocked: false } | { blocked: true; reason: GuardReason };

const OPEN: GuardVerdict = { blocked: false };
const block = (reason: GuardReason): GuardVerdict => ({ blocked: true, reason });

// A pasted job description is data for the model, not a request. A message
// counts as one only when it is JD-shaped (three distinct section markers;
// or, when long, the job-description starter's prefix or two markers), not
// because one keyword appears. Its opening and its last line are still screened.
const PASTE_HEAD_CHARS = 300;
const JOB_POST_MARKERS =
  /\b(?:job description|requirements|responsibilities|qualifications|about the role|about us|nice to have|must have|benefits|what you'll do|what we're looking for|years of experience|preferred skills)\b/g;

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

// Cyrillic and Greek letters that look like Latin ones ("ignоre" with a
// Cyrillic о). NFKC does not fold these.
const CONFUSABLES: Record<string, string> = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p",
  с: "c", т: "t", у: "y", х: "x", і: "i", ї: "i", ј: "j", ѕ: "s", һ: "h",
  ԁ: "d", ӏ: "l", ԛ: "q", ԝ: "w",
  α: "a", β: "b", ε: "e", η: "n", ι: "i", κ: "k", ν: "v", ο: "o", ρ: "p",
  τ: "t", υ: "u", χ: "x", ω: "w", ς: "s",
};
const CONFUSABLE = new RegExp(`[${Object.keys(CONFUSABLES).join("")}]`, "g");

function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[​-‍⁠﻿­]/g, "")
    .replace(/[‘’´`]/g, "'")
    .replace(/[“”„]/g, '"')
    .toLowerCase()
    .replace(CONFUSABLE, (c) => CONFUSABLES[c] ?? c)
    .replace(/\s+/g, " ")
    .trim();
}

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
};

/** "1gn0r3 4ll" → "ignore all": only tokens that mix letters and digits change. */
function unleet(text: string): string {
  return text.replace(/[a-z0-9@$]+/g, (token) =>
    /[a-z]/.test(token) && /[0-9@$]/.test(token)
      ? token.replace(/[0-9@$]/g, (c) => LEET[c] ?? c)
      : token,
  );
}

/** "i g n o r e previous" → "ignore previous": runs of 4+ single letters. */
function unspace(text: string): string {
  return text.replace(/\b(?:[a-z] ){3,}[a-z]\b/g, (run) => run.replace(/ /g, ""));
}

// Openers that do not change what is being asked: "please", "can you", "now".
const FILLER =
  /^(?:(?:please|pls|plz|kindly|now|then|and|also|ok|okay|so|just|great|good|thanks|thank you|hey|hi|bro|bhai|yes|first|next|finally|quickly|totally unrelated now|unrelated|as you (?:just )?agreed|can you|could you|would you|will you|can u|could u|you should|you must|i want you to|i need you to|help me|go ahead and|in architecture mode|to prove it)\b[\s,!-]*)+/;

/** Sentences and comma-separated parts, each without its polite opener. */
function clauses(text: string): string[] {
  return text
    .split(/[.?!;:\n।]+|,/)
    .map((part) => part.trim().replace(FILLER, "").trim())
    .filter(Boolean);
}

// Anything that points at him or at this site: "translate his summary" or
// "calculate his years of experience" are questions about his work.
const ABOUT_HIM =
  /\b(?:he|him|his|bhanu|rana|r[eé]sum[eé]|cv|this (?:site|copilot|assistant|portfolio)|copilot|unka|unke|unki|unhone|unhe|unse|unko|uska|uske)\b|भानु|उन(?:का|के|की|्होंने|से|को|्हें)/;

// "Did ATAL AI include a joke feature?" asks about a thing that exists.
const ASKS_ABOUT_A_THING = /^(?:did|does|has|have|had|was|were)\b/;
const ADDRESSES_THE_MODEL = /\byou(?:r|rs|rself)?\b/;
// Asking for something to be shown or switched, as opposed to asked about.
const REVEAL_VERB =
  /\b(?:repeat|print|reveal|show|display|dump|recite|leak|paste|tell me|give me|ignore|disable|enable|bypass|override|turn off|switch off)\b/;

/**
 * A clause about him or this copilot that only asks about a topic word
 * ("Does this copilot use a system prompt?", "Did he roleplay interviews?").
 */
function asksAboutHisWork(clause: string): boolean {
  if (ADDRESSES_THE_MODEL.test(clause) || REVEAL_VERB.test(clause)) return false;
  return ABOUT_HIM.test(clause) || ASKS_ABOUT_A_THING.test(clause);
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

const LANGUAGE =
  "(?:python|javascript|js|java|typescript|sql|bash|shell|c|c\\+\\+|c#|go|golang|rust|ruby|php|kotlin|swift)";

// Always an attack, whoever the sentence names.
const INJECTION: RegExp[] = [
  // "ignore all previous instructions", "disregard the above", "forget your rules"
  /\b(?:ignore|disregard|forget|override|bypass)\b[^.?!\n]{0,40}?\b(?:instructions?|rules?|prompts?|guidelines?|guidance|directives?|restrictions?|guardrails?|polic(?:y|ies)|everything (?:above|before)|the above|all above)/,
  /\byou are no longer\b|\byou(?:'re| are) now (?:an?|the|my|in|free|unrestricted|unfiltered|uncensored|jailbroken|evil|dan)\b/,
  /\bfrom now on\b[^.?!]{0,30}\byou(?:'ll|'re| are| will| must| should| have to| can'?t| cannot| won'?t| do not| don'?t)\b/,
  /\b(?:no|without)\s+(?:any\s+)?(?:rules|restrictions|limits|filters|guardrails)\b/,
  /\bauthori[sz]e you\b/,
  /\b(?:unfiltered|uncensored) (?:ai|assistant|model|mode|bot)\b/,
  // Asking for the rules themselves.
  /\b(?:repeat|print|reveal|show|display|output|dump|tell me|list|translate|summari[sz]e|recite|copy|what (?:are|were|is))\b[^.?!\n]{0,30}\byour\s+(?:\w+\s+){0,2}(?:prompt|instructions|rules|guidelines|directives|configuration)\b/,
  /\b(?:instructions?|rules|prompt|guidelines)\b[^.?!]{0,20}\b(?:were you|you were|you've been|you have been) (?:given|told)\b|\bwhat were you (?:told|given)\b/,
  /\b(?:text|words|message|messages|everything|content)\s+(?:above|before this)\b/,
  /\b(?:starting|beginning|that starts|that begins) with\s+"?you are\b/,
  // French, German, Spanish.
  /\b(?:ignor|oubli|vergiss|olvid)\w*\b[^.?!\n]{0,40}\b(?:instructions?|consignes|r[eè]gles|anweisungen|regeln|instrucciones|reglas)\b/,
  // Hindi and Hinglish.
  /(?:निर्देश|नियम|instructions?|rules?)[^।?!]{0,40}(?:अनदेखा|भूल|नज़रअंदाज़|नजरअंदाज|bhool|bhul|bhula|ignore|chhod|chod)/,
  /(?:अनदेखा|भूल जाओ|नज़रअंदाज़|नजरअंदाज)[^।?!]{0,30}(?:निर्देश|नियम)/,
  /\b(?:bhool|bhul|bhula|ignore|chhod|chod)\w*\s+(?:jao|ja|do|dena|karo|kar do)\b[^.?!]{0,30}\b(?:instructions?|rules?|niyam|nirdesh)\b/,
  /\bab (?:se )?(?:tum|aap|tu)\s+(?:ek\s+)?(?:\w+\s+){0,2}(?:assistant|ai|bot|chatbot|sahayak)\b/,
  /अब (?:से )?(?:तुम|आप|तू)[^।?!]{0,25}(?:सहायक|असिस्टेंट|assistant|बॉट)/,
];

// A persona switch at the start of a clause: "Act as a Linux terminal".
const PERSONA_CLAUSE =
  /^(?:act (?:as|like)|imagine (?:that )?you(?:'re| are)|simulate (?:an?|the|being)|behave (?:as|like)|play the (?:role|part) of|you(?:'re| are) (?:a|an) (?:unrestricted|unfiltered|uncensored|evil|jailbroken)\b)/;

// Topic words that are attacks only when the clause is not a question about
// him or this copilot: "How does this copilot defend against jailbreaks?" and
// "Can he decode Devanagari OCR output?" pass.
const INJECTION_TOPIC: RegExp[] = [
  /\b(?:system|developer|hidden|initial|original|secret)\s+(?:prompt|message|instructions?|policy|override)\b/,
  /\bdeveloper mode\b|\bjailbreak|\bdo anything now\b|\bstay in character\b|\bunrestricted\b/,
  /\b(?:pretend|roleplay|role-play)\b/,
  /\b(?:drop|remove|lift|disable|turn off)\b[^.?!]{0,20}\b(?:restrictions|rules|filters|guardrails|limits|safety)\b/,
  // Encoded payloads.
  /\bbase\s?-?64\b|\brot\s?-?13\b|\b(?:decode|decrypt|deobfuscate)\b|\bhex(?:adecimal)?[- ]encoded\b|\bleet\s?speak\b/,
  /सिस्टम प्रॉम्प्ट/,
];

const URL_TEXT = /\b(?:https?:\/\/|www\.)\S+/gi;

// A long run of base64 alphabet with mixed case and digits, as pasted payloads
// are. Links are left out: a GitHub path can look the same.
function hasEncodedBlob(raw: string): boolean {
  for (const run of raw.replace(URL_TEXT, " ").match(/[A-Za-z0-9+/]{32,}={0,2}/g) ?? []) {
    if (/[a-z]/.test(run) && /[A-Z]/.test(run) && /[0-9]/.test(run)) return true;
  }
  return false;
}

const CODE_NOUN =
  /\b(?:program|programs|function|functions|script|scripts|code|snippet|snippets|query|queries|regex|regexp|algorithm|implementation)\b/;
const CODE_VERB =
  /^(?:write|code|generate|create|compose|draft|implement|demonstrate|output|type out|give me|show me|send me|provide|make|build|produce)\b/;
// "Show me his code on GitHub" asks for a link, not for code.
const LINK_REQUEST = /\b(?:github|repo|repos|repository|repositories|link|links|url)\b/;

const CODE_ANYWHERE: RegExp[] = [
  /\bhello[\s,!-]*world\b/,
  /\b(?:code|program|script|function|query)\b[^.?!]{0,25}\b(?:likh|likho|likhdo|likhiye|likhna|likhke|bana do|banado|banao|de do|dedo)\b/,
  /(?:कोड|प्रोग्राम|स्क्रिप्ट|फ़ंक्शन|फंक्शन)[^।?!]{0,20}(?:लिखो|लिखें|लिखिए|लिख दो|लिखकर|बनाओ|बना दो)/,
];

const CODE_CLAUSE: RegExp[] = [
  // "print('hi')", 'print "hi"', "print hello in python"; not "Print his publications".
  /^print\s*\(|^print\s+["']/,
  new RegExp(`^print\\b[^.?!]*\\bin ${LANGUAGE}\\b`),
  // A bare imperative: "Implement binary search".
  /^implement\b/,
  // "Show how he would implement quicksort".
  /^(?:show|demonstrate|explain)(?: me| us)? how\b[^.?!]*\b(?:implement|code|program)s?\b/,
  // "How would I reverse a string in Python?"
  new RegExp(
    `^how (?:(?:would|do|can|could|should) (?:i|you|we|one)|to)\\b[^.?!]*\\bin ${LANGUAGE}\\b`,
  ),
];

// Code requests that name a language, unless the clause is about him
// ("Is he good with SQL?", "Which Python projects did he build?").
const CODE_CLAUSE_UNLESS_HIS: RegExp[] = [
  // "SQL to find duplicate rows", "Python function to reverse a string?"
  new RegExp(
    `^${LANGUAGE}\\b[^.?!]{0,30}\\b(?:to|that|which)\\s+(?:find|reverse|sort|print|select|count|parse|compute|calculate|check|convert|remove|delete|insert|read|return|fetch|generate|merge|split|validate|filter)s?\\b`,
  ),
  // "a python hello program", "javascript code for a timer"
  new RegExp(`\\b${LANGUAGE}\\s+(?:hello|program|script|snippet|function|code)\\b`),
];

// In a pasted job description only unmistakable requests count: JDs say
// "write clean Python code", never "write a Python function".
const STRONG_CODE_CLAUSE =
  /^(?:write|code|generate|create|give me|show me|implement|produce|output)\s+(?:me\s+)?(?:an?|one|some)\s+(?:[\w+#-]+\s+){0,3}(?:program|function|script|snippet|query|regex|class)\b/;

// Verse and jokes are never about his work; an essay or a story might be
// ("write the story of his career"), so those pass when they name him.
const VERSE_NOUN =
  /\b(?:poem|poems|poetry|haiku|limerick|sonnet|song|lyrics|joke|jokes|riddle|rap|shayari)\b/;
const PROSE_NOUN =
  /\b(?:essay|essays|story|stories|speech|novel|blog post|article|cover letter|linkedin post|tweet|tweets|thread)\b/;
const WRITE_VERB = /^(?:write|compose|draft|create|make|generate|sing|recite)\b/;
// "Tell me about his song projects" asks about his work.
const TELL_VERB = /^(?:tell me|give me|share|say)\b(?! about\b)/;

const SYSTEM_NOUN =
  /\b(?:system|app|application|website|service|api|backend|frontend|database|schema|url shortener|architecture|diagram|game|chatbot|startup|business plan|marketing plan|diet plan|workout plan|itinerary)\b/;
const DESIGN_VERB = /^(?:design|architect|build|create|make|develop|plan)\b(?: me| us)? (?:an?|the|my|our)\b/;

const NUMBER_WORD =
  "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)";

const TASK_ANYWHERE: RegExp[] = [
  /चुटकुला|शायरी/,
  /\b(?:kavita|poem|kahani|story|gaana|song|essay|nibandh)\b[^.?!]{0,20}\b(?:likh|likho|likhdo|sunao|suna do|banao|bana do)\b/,
  /(?:कविता|कहानी|निबंध|गाना)[^।?!]{0,15}(?:लिखो|सुनाओ|लिखिए|सुनाइए|बनाओ)/,
  // French, German, Spanish: "écris un poème", "schreibe ein Gedicht".
  /(?<![a-zà-ÿ])(?:[ée]cri[st]|[ée]crivez|schreib\w*|escrib\w*)\b[^.?!]{0,25}\b(?:po[eè]me|gedicht|poema|chanson|lied|canci[oó]n|blague|witz|chiste|code|c[oó]digo|programm\w*)\b/,
  // Arithmetic and equations: "17 times 23", "17x23", "3x + 7 = 22", "x^2".
  // No "/" or "-": "24/7" and "2024-2025" are not sums.
  /\b\d+(?:\.\d+)?\s*(?:[+*×÷^x]|times|plus|multiplied by|divided by)\s*\d+/,
  new RegExp(`\\b${NUMBER_WORD}\\b[a-z -]{0,12}?\\s(?:times|plus|minus|multiplied by|divided by)\\s+${NUMBER_WORD}\\b`),
  /\b\d*[a-z]\s*[+-]\s*\d+\s*=\s*-?\d+/,
  /\b[a-z]\s*\^\s*\d/,
  /\bsolve for\b/,
];

// Topic words that are tasks only when the clause is not about his work:
// "Has he built a weather prediction model?" passes.
const TASK_TOPIC: RegExp[] = [
  /\b(?:haiku|limerick|sonnet|jokes?|riddles?|chutkul[ae]|shayari)\b/,
  /\brecipes?\b|\bweather\b|\bmausam\b|मौसम|\bworld cup\b/,
  /\b(?:top|latest|today'?s|current|breaking)\s+(?:news|headlines)\b|\bheadlines\b|\bnews today\b/,
];

const TASK_VERB =
  /^(?:solve|calculate|compute|integrate|differentiate|simplify|evaluate|factori[sz]e|translate|convert)\b/;
const TRANSLATE_HINGLISH = /\b(?:translate|anuvad|anuvaad)\s+(?:karo|kar do|kijiye|karna)\b|अनुवाद कर(?:ो|ें|िए|ना| दो)/;

// Questions about the world, not about him: only blocked when retrieval found
// no note at all, so a question that touches his work always reaches the model.
const GENERAL_KNOWLEDGE =
  /\bcapital of\b|\bwho won\b|\b(?:president|prime minister|king|queen|ceo) of\b|\bhow (?:do|can|to) (?:i |you |we )?(?:fix|repair|cook|bake)\b|\bexplain how\b|\bhow (?:does|do) (?:an? |the )?\w+(?: \w+)? (?:work|fly)\b|\bwhich is better\b|\bmeaning of life\b|\bstock price\b/;

function injected(text: string): boolean {
  if (INJECTION.some((rule) => rule.test(text))) return true;
  return clauses(text).some(
    (clause) =>
      PERSONA_CLAUSE.test(clause) ||
      (INJECTION_TOPIC.some((rule) => rule.test(clause)) && !asksAboutHisWork(clause)),
  );
}

function asksForCode(text: string): boolean {
  if (CODE_ANYWHERE.some((rule) => rule.test(text))) return true;
  return clauses(text).some((clause) => {
    if (CODE_CLAUSE.some((rule) => rule.test(clause))) return true;
    if (!ABOUT_HIM.test(clause) && CODE_CLAUSE_UNLESS_HIS.some((rule) => rule.test(clause))) {
      return true;
    }
    if (!CODE_VERB.test(clause) || !CODE_NOUN.test(clause)) return false;
    return !(LINK_REQUEST.test(clause) && /\b(?:his|bhanu'?s?)\b/.test(clause));
  });
}

function asksForTask(text: string, retrievedCount: number | undefined): boolean {
  if (TASK_ANYWHERE.some((rule) => rule.test(text))) return true;
  if (!ABOUT_HIM.test(text) && TRANSLATE_HINGLISH.test(text)) return true;
  for (const clause of clauses(text)) {
    if ((WRITE_VERB.test(clause) || TELL_VERB.test(clause)) && VERSE_NOUN.test(clause)) {
      return true;
    }
    if (TASK_TOPIC.some((rule) => rule.test(clause)) && !asksAboutHisWork(clause)) return true;
    if (ABOUT_HIM.test(clause)) continue;
    if (WRITE_VERB.test(clause) && PROSE_NOUN.test(clause)) return true;
    if (TASK_VERB.test(clause)) return true;
    if (DESIGN_VERB.test(clause) && SYSTEM_NOUN.test(clause)) return true;
  }
  return retrievedCount === 0 && !ABOUT_HIM.test(text) && GENERAL_KNOWLEDGE.test(text);
}

const JD_PREFIX = normalise(jobDescriptionPrompt);

// A short posting still has its sections: three distinct markers make one,
// whatever its length. A question rarely names three ("requirements and
// benefits of his ATAL AI work" names two).
const SHORT_POST_MARKERS = 3;

function isPastedJobPost(text: string): boolean {
  const markers = new Set(text.match(JOB_POST_MARKERS) ?? []).size;
  if (markers >= SHORT_POST_MARKERS) return true;
  if (text.length <= PASTE_HEAD_CHARS) return false;
  if (text.startsWith(JD_PREFIX)) return true;
  return markers >= 2;
}

/** The parts of a pasted job description that can carry a request to the model. */
function pasteEdges(question: string): string[] {
  const lines = question.split(/\n/).map((line) => line.trim()).filter(Boolean);
  const last = lines.at(-1) ?? "";
  return [normalise(question).slice(0, PASTE_HEAD_CHARS), normalise(last).slice(-PASTE_HEAD_CHARS)];
}

function screenPaste(question: string): GuardVerdict {
  for (const part of pasteEdges(question)) {
    if (injected(part) || injected(unleet(part)) || injected(unspace(part))) {
      return block("injection");
    }
    if (
      CODE_ANYWHERE.some((rule) => rule.test(part)) ||
      clauses(part).some(
        (clause) =>
          STRONG_CODE_CLAUSE.test(clause) || /^print\s*\(/.test(clause),
      )
    ) {
      return block("code");
    }
    if (
      clauses(part).some(
        (clause) =>
          (WRITE_VERB.test(clause) || TELL_VERB.test(clause)) && VERSE_NOUN.test(clause),
      )
    ) {
      return block("task");
    }
  }
  return OPEN;
}

/**
 * Whether a question is refused before the model is called. `retrievedCount`
 * is how many notes retrieval found; general-knowledge questions are only
 * refused when it is 0. Omitted, those questions always pass.
 */
export function screenQuestion(
  question: string,
  options: { retrievedCount?: number } = {},
): GuardVerdict {
  const text = normalise(question);
  if (!text) return OPEN;
  if (isPastedJobPost(text)) return screenPaste(question);

  const leet = unleet(text);
  // "DAN" is only a marker in capitals; "dan" is a name.
  if (
    injected(text) ||
    injected(leet) ||
    injected(unspace(text)) ||
    /\bDAN\b/.test(question) ||
    hasEncodedBlob(question)
  ) {
    return block("injection");
  }
  if (asksForCode(text) || asksForCode(leet)) return block("code");
  if (asksForTask(text, options.retrievedCount)) return block("task");
  return OPEN;
}

/**
 * Whether the message is a pasted job description, by the same test the guard
 * uses. The route tells the model so: such a message is always answered with
 * the three lists, and any instruction planted in it is data.
 */
export function isJobDescription(question: string): boolean {
  return isPastedJobPost(normalise(question));
}

/**
 * The fixed refusal in the owner's wording, in the script the visitor wrote in:
 * the same text the system prompt gives the model.
 */
export function guardRefusal(question: string): string {
  return declineText(replyScript(question));
}

// ---------------------------------------------------------------------------
// Answer signatures
// ---------------------------------------------------------------------------

/** How long a served answer stays trusted history. */
export const SIGNATURE_MAX_AGE_SECONDS = 24 * 60 * 60;
// Clock drift allowed between instances.
const SIGNATURE_FUTURE_SKEW_SECONDS = 5 * 60;

const HKDF_SALT = "portfolio-copilot";
const HKDF_INFO = "chat-answer-signature-v1";
let processKey: Buffer | null = null;

/**
 * CHAT_SIGNING_KEY when set; otherwise a key derived from GROQ_API_KEY, so no
 * new secret is needed; with neither, a random key for this process (there is
 * no model to protect then, and it only means old answers stop verifying).
 */
export function signingKey(env: Record<string, string | undefined>): Buffer {
  const secret = env.CHAT_SIGNING_KEY || env.GROQ_API_KEY;
  if (!secret) {
    processKey ??= randomBytes(32);
    return processKey;
  }
  const info = env.CHAT_SIGNING_KEY ? `${HKDF_INFO}:explicit` : HKDF_INFO;
  return Buffer.from(hkdfSync("sha256", secret, HKDF_SALT, info, 32));
}

// Whitespace is left out: the browser trims, swaps odd spaces and drops a thin
// space inside "570 +", and none of that changes what the answer says.
const CUT_OFF_CANONICAL = CUT_OFF_SUFFIX.replace(/\s+/g, "");

function canonical(text: string): string {
  return text.replace(/‑/g, "-").replace(/\s+/g, "");
}

function canonicalAnswer(answer: string): string {
  let text = canonical(answer);
  if (text.endsWith(CUT_OFF_CANONICAL)) text = text.slice(0, -CUT_OFF_CANONICAL.length);
  return text.slice(0, SIGNED_ANSWER_CHARS);
}

function canonicalUser(user: string): string {
  return canonical(user).slice(0, SIGNED_USER_CHARS);
}

function mac(key: Buffer, issuedAt: number, user: string, answer: string): Buffer {
  const u = canonicalUser(user);
  const a = canonicalAnswer(answer);
  // Length-prefixed, so no split of one string into two can collide.
  return createHmac("sha256", key).update(`v2:${issuedAt}:${u.length}:${u}${a}`).digest();
}

const nowSeconds = (nowMs: number) => Math.floor(nowMs / 1000);

/**
 * `<issued-at seconds>.<base64url HMAC-SHA256>` over the issue time, the
 * answer and the question it answers.
 */
export function signAnswer(
  key: Buffer,
  user: string,
  answer: string,
  nowMs: number = Date.now(),
): string {
  const issuedAt = nowSeconds(nowMs);
  return `${issuedAt}.${mac(key, issuedAt, user, answer).toString("base64url")}`;
}

/** The answer up to the end of its signed part: nothing unsigned is kept. */
function signedPart(answer: string): string {
  let seen = 0;
  for (let i = 0; i < answer.length; i += 1) {
    if (/\s/.test(answer[i])) continue;
    seen += 1;
    if (seen === SIGNED_ANSWER_CHARS) return answer.slice(0, i + 1);
  }
  return answer;
}

/**
 * The text of an assistant turn to keep, or null when its signature is
 * missing, expired, or does not match this answer to this question.
 */
export function trustedAnswer(
  key: Buffer,
  user: string,
  answer: string,
  signature: unknown,
  nowMs: number = Date.now(),
): string | null {
  if (typeof signature !== "string" || !SIGNATURE_PATTERN.test(signature)) return null;
  const dot = signature.indexOf(".");
  const issuedAt = Number(signature.slice(0, dot));
  const age = nowSeconds(nowMs) - issuedAt;
  if (age > SIGNATURE_MAX_AGE_SECONDS || age < -SIGNATURE_FUTURE_SKEW_SECONDS) return null;
  const given = Buffer.from(signature.slice(dot + 1), "base64url");
  const expected = mac(key, issuedAt, user, answer);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  return signedPart(answer).trim();
}
