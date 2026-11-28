// The site's retriever: keyword and tag matching over the hand-written cards.
// No embeddings and no model call, so the same function runs on the server
// (to build the prompt) and in the browser (to light the index while typing).
// retrieve() is the one entry point for both; everything here is pure.

import {
  kindLabel,
  knowledgeBase,
  profile,
  type KnowledgeItem,
  type SourceRef,
} from "./knowledge";
import { expandToken, expansionKeys, foldDevanagari } from "./query-expansion";

export type ChatMode = "default" | "architecture";

/** Cards sent to the model in full. */
export const RETRIEVAL_K = 6;
/** For inputs over LONG_INPUT_CHARS, such as a pasted job description. */
export const LONG_INPUT_K = 8;
export const LONG_INPUT_CHARS = 600;
/**
 * Absolute floor: one hit on a tag or alias. Hits in body text alone must add
 * up to it, which is what keeps off-topic questions at zero cards.
 */
export const MIN_SCORE = 4;

const MAX_INPUT_CHARS = 6000;
const WEIGHT = { title: 5, tag: 4, summary: 2, body: 1 } as const;
// Added when a multi-word tag or alias ("Computer Vision", "open-source")
// appears in the question as the same run of words, on top of what its words
// score singly.
const PHRASE_SCORE = 6;
// Below one title hit, a question is treated as leaning on the one before it.
const FOLLOW_UP_SCORE = 5;
// In that case the new question's own words count double, so its one keyword
// is not buried under the previous question's cards.
const LATEST_WEIGHT = 2;
const LOCAL_ANSWER_CARDS = 3;

export type RankedCard = {
  item: KnowledgeItem;
  score: number;
  /** Query terms, as the visitor typed them, that hit this card. */
  matched: string[];
};

/** A word-list substitution that was applied, e.g. अनुभव → experience. */
export type Expansion = { from: string; to: string[] };

export type Retrieval = {
  ranked: RankedCard[];
  expansions: Expansion[];
  /** The latest message matched little, so an earlier question was scored with it. */
  reusedPrevious: boolean;
  k: number;
};

/* ------------------------------------------------------------------ */
/* Text → tokens                                                        */
/* ------------------------------------------------------------------ */

export function normalise(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u200c\u200d]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_INPUT_CHARS);
}

// Devanagari matras and the virama are marks (\p{M}) and must stay attached to
// their consonants. The danda (U+0964, U+0965) is punctuation, so it splits.
// \b and \w are ASCII-only in JavaScript and are not used anywhere here.
const SEPARATORS = /[^\p{L}\p{M}\p{N}+#.]+/u;
const OUTER_DOTS = /^\.+|\.+$/g;
const OUTER_SIGNS = /^[+#]+|[+#]+$/g;
// The text ends inside a word: the visitor is still typing it.
const OPEN_END = /[\p{L}\p{M}\p{N}+#]$/u;
const ASCII_WORD = /^[a-z]+$/;
const NON_ASCII = /\P{ASCII}/u;

const STOP_WORDS = new Set(
  `
  a an and are as at be for from has have he her his how i in is it me of on or
  show tell the to what why with you
  about should we him can does did do who which where when any your please give
  list explain describe bhanu pratap rana
  am was were been being had will would could may might shall
  she they them their its my our us this that these those there here
  not no yes but if so than then too very just also more most other another
  some such only own same both each all one into over out up by per via
  get got make made let like want need know see look say said ask
  build built building work worked working use used using best
  doesn don didn isn aren hasn haven wasn weren won
  के का की को ने से में पर है हैं हूँ था थे थी हो होता होती क्या कौन कौनसा कैसे कैसा
  कैसी कहाँ कब क्यों किस किसी कितना कितने कितनी उनका उनके उनकी उन्होंने उनसे उन्हें
  उसका उसके उसकी वह वे यह ये इस उस इन उन जो और या भी तो कि ही लिए बारे साथ एक कोई
  कुछ सा सी कर करें करते करती करता करना किया किए की गया गई हुआ हुई हुए बनाए बनाया
  बनाई बताइए बताओ बताएं दिखाइए दिखाओ मुझे हमें आप अपने अपना कृपया
  kya hai hain ka ki ke ko ne se mein par aur ya bhi toh ek koi kuch unka unke
  unki unhone unse kaise kaisa kaisi kahan kahaan kab kyun kyon kaun kis kisi
  liye saath yeh woh wo tha thi ho hota kar karo karein karen karna karta
  karte kiya kiye gaya gayi hua hui banaya banaye batao bataiye dikhao mujhe
  apna apne
  `
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => foldDevanagari(normalise(word))),
);

// English plurals only: "databases" ↔ "database", "technologies" ↔ "technology".
// Possessives never reach here, because the apostrophe is a separator.
function singular(token: string): string {
  if (token.length <= 3 || !ASCII_WORD.test(token)) {
    return token;
  }
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (/(sses|shes|ches|xes|zes)$/.test(token)) {
    return token.slice(0, -2);
  }
  if (token.endsWith("ss") || token.endsWith("us")) {
    return token;
  }
  if (token.endsWith("is") && token.length > 4) {
    return token;
  }
  return token.endsWith("s") ? token.slice(0, -1) : token;
}

function isStopWord(word: string): boolean {
  const key = foldDevanagari(word);
  return STOP_WORDS.has(key) || STOP_WORDS.has(singular(key));
}

// Words in order, outer dots stripped ("Next.js." → "next.js"); "" where a
// piece was only dots, so positions still line up with the raw split.
function pieces(text: string): string[] {
  return normalise(text)
    .split(SEPARATORS)
    .map((piece) => piece.replace(OUTER_DOTS, ""));
}

function isUsable(word: string): boolean {
  return word.length >= 2 && !isStopWord(word);
}

/** Content words of a text, in order: normalised, stop words removed. */
export function tokenize(text: string): string[] {
  return pieces(text).filter(isUsable);
}

// Every form one word is matched under: itself, the name in front of a dotted
// suffix ("bytical.ai" → "bytical", "next.js" → "next"; not "m.tech" → "tech"),
// the word without outer signs ("570+" → "570"), and the singular of each.
// Index and query both go through this.
function variants(word: string): string[] {
  const forms = new Set<string>([word]);
  const dot = word.indexOf(".");
  if (dot >= 3) {
    forms.add(word.slice(0, dot));
  }
  const bare = word.replace(OUTER_SIGNS, "");
  if (bare.length >= 2) {
    forms.add(bare);
  }
  for (const form of [...forms]) {
    forms.add(singular(form));
  }
  return [...forms];
}

/* ------------------------------------------------------------------ */
/* Index — built once, when the module loads                            */
/* ------------------------------------------------------------------ */

type CardIndex = {
  item: KnowledgeItem;
  /** Best field weight per token. */
  weights: Map<string, number>;
  /** Multi-word tags and aliases as runs of singular tokens. */
  phrases: string[][];
};

// "open-source", "real-time", "GPT-4o": a hyphenated label is one unit.
const COMPOUND = /[\p{L}\p{N}]-[\p{L}\p{N}]/u;

function indexCard(item: KnowledgeItem): CardIndex {
  const weights = new Map<string, number>();
  const add = (text: string, weight: number) => {
    for (const word of tokenize(text)) {
      for (const form of variants(word)) {
        if ((weights.get(form) ?? 0) < weight) {
          weights.set(form, weight);
        }
      }
    }
  };

  // The card's kind and section name ("project", "Background") are indexed
  // with its tags, so "projects" and अनुभव find the right group of cards.
  const labels = [...item.tags, ...(item.aliases ?? []), item.kind, kindLabel[item.kind]];
  // The parts of a hyphenated label do not count as tags on their own ("open"
  // must not find "open-source"); the label still matches as a run of words.
  const single = labels.flatMap((label) =>
    label.split(/\s+/).filter((chunk) => !COMPOUND.test(chunk)),
  );
  add(item.body, WEIGHT.body);
  add(item.summary, WEIGHT.summary);
  add(single.join("\n"), WEIGHT.tag);
  add(item.title, WEIGHT.title);

  const phrases = new Map<string, string[]>();
  for (const label of labels) {
    const run = tokenize(label).map(singular);
    if (run.length >= 2) {
      phrases.set(run.join(" "), run);
    }
  }

  return { item, weights, phrases: [...phrases.values()] };
}

const INDEX: CardIndex[] = knowledgeBase.map(indexCard);

/** True when the term is a token of at least one card. */
export function isIndexed(term: string): boolean {
  const forms = tokenize(term).flatMap(variants);
  return INDEX.some(({ weights }) => forms.some((form) => weights.has(form)));
}

/* ------------------------------------------------------------------ */
/* Query → terms                                                        */
/* ------------------------------------------------------------------ */

type Term = {
  typed: string;
  /** Duplicate check: "project" and "projects" are one term. */
  key: string;
  /** The word's own variants plus the variants of its expansions. */
  forms: string[];
  /** Still being typed: also matches index tokens it is a prefix of. */
  prefix: boolean;
  /** The word the draft ends in, of any length: it may not be finished yet. */
  open: boolean;
};

type Analysis = { terms: Term[]; sequence: string[]; expansions: Expansion[] };

const MIN_PREFIX_CHARS = 3;

// Index terms the word list gives for a word; [] when it is not listed.
function expansionTargets(word: string, typing: boolean): string[] {
  const exact = expandToken(word);
  const folded = exact.from === undefined ? expandToken(singular(word)) : exact;
  const targets = new Set(folded.from === undefined ? [] : folded.terms);
  // A listed word that is still being typed: "प्रका" → प्रकाशन → publications.
  // Devanagari only: Hindi words are not index tokens, so the list is their
  // only way in. An English draft already prefix-matches the index itself, and
  // through the list "comp" (company) lit every job and "stu" (study) education.
  if (typing && NON_ASCII.test(word)) {
    const start = foldDevanagari(word);
    for (const listed of expansionKeys) {
      if (listed.startsWith(start)) {
        for (const term of expandToken(listed).terms) {
          targets.add(term);
        }
      }
    }
  }
  return [...targets];
}

function analyse(text: string, partial: boolean): Analysis {
  const analysis: Analysis = { terms: [], sequence: [], expansions: [] };
  const words = pieces(text);
  const openEnded = partial && OPEN_END.test(text);
  const seen = new Set<string>();

  words.forEach((word, position) => {
    if (!isUsable(word)) {
      return;
    }
    const key = singular(word);
    analysis.sequence.push(key);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);

    const open = openEnded && position === words.length - 1;
    const typing = open && word.length >= MIN_PREFIX_CHARS;
    const forms = new Set(variants(word));
    const targets = expansionTargets(word, typing);
    for (const target of targets) {
      for (const form of tokenize(target).flatMap(variants)) {
        forms.add(form);
      }
    }
    if (targets.length > 0) {
      analysis.expansions.push({ from: word, to: targets });
    }
    analysis.terms.push({ typed: word, key, forms: [...forms], prefix: typing, open });
  });

  return analysis;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                              */
/* ------------------------------------------------------------------ */

function termWeight(card: CardIndex, term: Term): number {
  let best = 0;
  for (const form of term.forms) {
    const weight = card.weights.get(form) ?? 0;
    if (weight > best) {
      best = weight;
    }
  }
  if (term.prefix) {
    for (const [token, weight] of card.weights) {
      if (weight > best && token.startsWith(term.typed)) {
        best = weight;
      }
    }
  }
  return best;
}

function containsRun(sequence: string[], run: string[]): boolean {
  for (let start = 0; start + run.length <= sequence.length; start += 1) {
    if (run.every((token, offset) => sequence[start + offset] === token)) {
      return true;
    }
  }
  return false;
}

type Weighted = { analysis: Analysis; weight: number };

// A card's score is the sum, over the distinct words of the question, of the
// best field the word (or one of its expansions) is a whole token of, plus
// PHRASE_SCORE for each multi-word label found as a run. Nothing is matched
// as a substring. Earlier parts win a duplicate term, so the latest question
// is listed first.
function rank(parts: Weighted[]): RankedCard[] {
  const terms: { term: Term; weight: number }[] = [];
  const seen = new Set<string>();
  for (const { analysis, weight } of parts) {
    for (const term of analysis.terms) {
      if (!seen.has(term.key)) {
        seen.add(term.key);
        terms.push({ term, weight });
      }
    }
  }
  if (terms.length === 0) {
    return [];
  }

  const scored = INDEX.map((card, order) => {
    let score = 0;
    const matched: string[] = [];
    for (const { term, weight } of terms) {
      const hit = termWeight(card, term);
      if (hit > 0) {
        score += hit * weight;
        matched.push(term.typed);
      }
    }
    for (const run of card.phrases) {
      const part = parts.find(({ analysis }) => containsRun(analysis.sequence, run));
      if (!part) {
        continue;
      }
      score += PHRASE_SCORE * part.weight;
      // A hyphenated label has no single-word hits, so name its words here.
      for (const { term } of terms) {
        if (run.includes(term.key) && !matched.includes(term.typed)) {
          matched.push(term.typed);
        }
      }
    }
    return { item: card.item, score, matched, order };
  });

  return scored
    .filter(({ score }) => score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ item, score, matched }) => ({ item, score, matched }));
}

/**
 * Every card scoring at least MIN_SCORE, best first, ties in knowledgeBase
 * order. `partial` is for live typing: the last word, if it has three or more
 * characters and nothing after it, matches as a prefix.
 */
export function scoreKnowledge(query: string, opts?: { partial?: boolean }): RankedCard[] {
  return rank([{ analysis: analyse(query, opts?.partial === true), weight: 1 }]);
}

function mergeExpansions(...lists: Expansion[][]): Expansion[] {
  const merged = new Map<string, Expansion>();
  for (const expansion of lists.flat()) {
    if (!merged.has(expansion.from)) {
      merged.set(expansion.from, expansion);
    }
  }
  return [...merged.values()];
}

const PROFILE_CARD_ID = "profile-summary";
const PERSON_QUESTION =
  /(^|[^\p{L}\p{M}])(bhanu|rana|भानु|राणा|about him|who is he|introduce him|उनके बारे|unke baare)(?![\p{L}\p{M}])/u;

/** A short question that names him and asks nothing more specific. */
function asksAboutPerson(text: string): boolean {
  const clean = normalise(text);
  return clean.split(" ").length <= 8 && PERSON_QUESTION.test(clean);
}

// Words that point back at the previous answer's topic. They are stop words,
// so they never reach the terms and are looked for in the raw words instead.
const TOPIC_ANAPHORS = `
  it its that this there those them same
  यह वह इस उस इसका इसके इसकी उसका उसके उसकी इसमें उसमें वहाँ
  iska iske iski uska uske uski isme usme waha wahan
`;
// Words of a generic follow-up: they name no topic of their own, so "What
// else?" or "Can you elaborate?" still means the previous question. Kept apart
// from the stop words so the card index is unchanged.
const FOLLOW_UP = `
  else anything more again go continue elaborate expand explain further detail
  details example examples interesting ok okay thanks why challenge challenges
  problem problems difficult difficulty difficulties face faced solve solved
  learn learned learnt lesson lessons outcome outcomes result results
  विस्तार बताइए बताओ बताएं और कुछ
  aur kuch batao bataiye vistar
`;

function wordSet(list: string): Set<string> {
  return new Set(
    list
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => foldDevanagari(normalise(word))),
  );
}

const TOPIC_WORDS = wordSet(TOPIC_ANAPHORS);
const FOLLOW_UP_WORDS = wordSet(FOLLOW_UP);

function hasWord(text: string, words: Set<string>): boolean {
  return pieces(text).some((word) => words.has(foldDevanagari(word)));
}

// A finished word that is a token of no card, through none of its forms or
// expansions, and not a generic follow-up word. The word still being typed is
// not judged: "wh" may become "what".
function isUnknown(term: Term): boolean {
  if (term.open || FOLLOW_UP_WORDS.has(foldDevanagari(normalise(term.typed)))) return false;
  return !INDEX.some(({ weights }) => term.forms.some((form) => weights.has(form)));
}

// The latest question's own cards first, then the rest of the merged ranking,
// each card once. Entries come from the merged ranking so `matched` names the
// words of both questions.
function leadWith(alone: RankedCard[], merged: RankedCard[]): RankedCard[] {
  const byId = new Map(merged.map((entry) => [entry.item.id, entry]));
  const first = new Set(alone.map(({ item }) => item.id));
  return [
    ...alone.map((entry) => byId.get(entry.item.id) ?? entry),
    ...merged.filter(({ item }) => !first.has(item.id)),
  ];
}

/**
 * The one entry point, used by the API route and by the browser preview.
 * `userMessages` is every user message in the thread, oldest first.
 */
export function retrieve(input: { userMessages: string[]; partial?: boolean }): Retrieval {
  const messages = input.userMessages;
  const latest = messages[messages.length - 1] ?? "";
  const k = normalise(latest).length > LONG_INPUT_CHARS ? LONG_INPUT_K : RETRIEVAL_K;
  const own = analyse(latest, input.partial === true);
  const alone = rank([{ analysis: own, weight: 1 }]);
  // With no "it" or "that", a weak new keyword is a change of topic, so its
  // own cards lead; with one, the previous topic stays first. "He" and "his"
  // are always Bhanu here, so they never tie a question to the previous topic.
  const switchesTopic = alone.length > 0 && !hasWord(latest, TOPIC_WORDS);

  // "Who is Bhanu?" has no keyword left once the name is set aside, but it
  // has an obvious answer. Only for finished questions, never mid-typing.
  if (alone.length === 0 && input.partial !== true && asksAboutPerson(latest)) {
    const summary = knowledgeBase.find((item) => item.id === PROFILE_CARD_ID);
    if (summary) {
      return {
        ranked: [{ item: summary, score: MIN_SCORE, matched: ["bhanu"] }],
        expansions: own.expansions,
        reusedPrevious: false,
        k,
      };
    }
  }

  // "What is the weather in Paris?" after a question about ATAL AI is not a
  // follow-up: it names something no card knows. Reusing the earlier question
  // would hand the model ATAL AI's notes as evidence for it. A pointer word
  // is no exception: off-topic questions are full of "it" and "there". Only
  // generic follow-up words ("what else?", "tell me more") still reuse.
  // The same holds when its only match is weak ("this year" brushing the
  // profile's "years"): it keeps that match but borrows nothing.
  if ((alone[0]?.score ?? 0) < FOLLOW_UP_SCORE && own.terms.some(isUnknown)) {
    return { ranked: alone, expansions: own.expansions, reusedPrevious: false, k };
  }

  if ((alone[0]?.score ?? 0) < FOLLOW_UP_SCORE) {
    // "Tell me more about that" has no keywords of its own. Lean on the most
    // recent earlier question that did retrieve something.
    for (let index = messages.length - 2; index >= 0; index -= 1) {
      const earlier = analyse(messages[index], false);
      if (rank([{ analysis: earlier, weight: 1 }]).length === 0) {
        // "Who is Bhanu?" retrieves through the person rule, not by keyword;
        // a follow-up to it should keep the profile summary.
        const summary = asksAboutPerson(messages[index])
          ? knowledgeBase.find((item) => item.id === PROFILE_CARD_ID)
          : undefined;
        if (!summary) continue;
        const extra = rank([{ analysis: own, weight: LATEST_WEIGHT }]).filter(
          ({ item }) => item.id !== PROFILE_CARD_ID,
        );
        const person: RankedCard = { item: summary, score: MIN_SCORE, matched: ["bhanu"] };
        return {
          ranked: (switchesTopic ? [...extra, person] : [person, ...extra]).slice(0, k),
          expansions: own.expansions,
          reusedPrevious: true,
          k,
        };
      }
      const combined = rank([
        { analysis: own, weight: LATEST_WEIGHT },
        { analysis: earlier, weight: 1 },
      ]);
      return {
        ranked: (switchesTopic ? leadWith(alone, combined) : combined).slice(0, k),
        expansions: mergeExpansions(own.expansions, earlier.expansions),
        reusedPrevious: true,
        k,
      };
    }
  }

  return { ranked: alone.slice(0, k), expansions: own.expansions, reusedPrevious: false, k };
}

/**
 * Legacy shape: the top cards only. With no usable words at all it returns
 * the leading cards, which retrieve() deliberately does not.
 */
export function retrieveKnowledge(query: string, limit = 5): KnowledgeItem[] {
  if (tokenize(query).length === 0) {
    return knowledgeBase.slice(0, limit);
  }
  return scoreKnowledge(query)
    .slice(0, limit)
    .map(({ item }) => item);
}

/* ------------------------------------------------------------------ */
/* Prompt context and the no-model answer                               */
/* ------------------------------------------------------------------ */

const NOTHING_RETRIEVED =
  "No card matched this question. Answer only from the profile index above, or say the profile does not cover it.";

function evidenceEntry(item: KnowledgeItem, index: number): string {
  const head = `[${index + 1}] ${item.title} (${item.kind}; basis: ${item.basis}; tags: ${item.tags.join(", ")})`;
  const links = (item.links ?? []).map(({ label, href }) => `${label} — ${href}`).join("; ");
  return links ? `${head}\n${item.body}\nLinks: ${links}` : `${head}\n${item.body}`;
}

/**
 * The context message for the model. `query` is the latest question, or every
 * user message oldest → newest. [n] in the evidence is the citation number,
 * and `retrieved[n - 1]` is the card it refers to.
 */
export function buildGroundingContext(
  query: string | string[],
  mode: ChatMode,
): { context: string; retrieved: KnowledgeItem[]; retrieval: Retrieval } {
  // The mode shapes the answer, never the evidence: it used to be prepended to
  // the query, which changed what was retrieved.
  void mode;
  const retrieval = retrieve({ userMessages: Array.isArray(query) ? query : [query] });
  const retrieved = retrieval.ranked.map(({ item }) => item);
  const index = knowledgeBase.map((item) => `${item.title}: ${item.summary}`).join("\n");
  const evidence =
    retrieved.length > 0 ? retrieved.map(evidenceEntry).join("\n\n") : NOTHING_RETRIEVED;

  return {
    context: `FULL PROFILE INDEX\n${index}\n\nRETRIEVED EVIDENCE\n${evidence}`,
    retrieved,
    retrieval,
  };
}

export function toSourceRefs(items: KnowledgeItem[]): SourceRef[] {
  return items.map(({ id, title, summary }) => ({ id, title, summary }));
}

/**
 * The answer when no model is available. It only quotes cards: titles,
 * summaries and links, word for word. The question and mode are accepted for
 * the caller's convenience and change nothing.
 */
export function localAnswer(query: string, mode: ChatMode, sources: KnowledgeItem[]): string {
  void query;
  void mode;
  if (sources.length === 0) {
    return `The model is unavailable right now and no note matches that question. Email ${profile.email} or read the resume.`;
  }

  const notes = sources.slice(0, LOCAL_ANSWER_CARDS).map((item) => {
    const note = `**${item.title}** — ${item.summary}`;
    const links = (item.links ?? []).map(({ label, href }) => `[${label}](${href})`).join(" · ");
    return links ? `${note}\n${links}` : note;
  });

  return `The model is unavailable right now, so here are the matching notes from the index:\n\n${notes.join("\n\n")}`;
}
