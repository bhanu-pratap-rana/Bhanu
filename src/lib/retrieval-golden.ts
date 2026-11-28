// A regression check for the lexical retriever, not a benchmark: the same
// person wrote the questions, the cards and the synonym list. The page shows
// the pass counts of evaluateRetrieval() and the test output lists every
// miss, so nothing here may be special-cased in rag.ts.

import { knowledgeBase } from "./knowledge";
import { retrieve } from "./rag";

export type GoldenLang = "en" | "hi" | "hinglish";

/** A hit means at least one id in `expect` is in the top `within` results. */
export type GoldenQuestion = {
  q: string;
  expect: string[];
  within: 1 | 3;
  lang: GoldenLang;
};

export type RetrievalEval = {
  total: number;
  hits: number;
  misses: { q: string; expected: string[]; got: string[] }[];
  byLang: Record<GoldenLang, { total: number; hits: number }>;
  offTopic: { total: number; clean: number };
  /** The same off-topic questions, each asked after every on-topic opener. */
  offTopicFollowUp: { total: number; clean: number };
};

// Cards whose own prompt names the thing it describes: the card must be first.
const NAMED_IN_PROMPT = new Set([
  "atal-ai",
  "hindi-semantic-search",
  "voice-ai-assistant",
  "aura-ai",
  "testneo-api-generator",
  "smart-hr-tool",
  "eye-disease-classification",
  "custom-document-ai-chatbot",
  "bolchaal-hindi",
  "bytical-ai",
]);

// Every card's own prompt must find that card. Derived, so it cannot go stale.
const cardPrompts: GoldenQuestion[] = knowledgeBase.map((card) => ({
  q: card.prompt,
  expect: [card.id],
  within: NAMED_IN_PROMPT.has(card.id) ? 1 : 3,
  lang: "en",
}));

const SKILL_CARDS = [
  "skills-genai-rag",
  "skills-agents",
  "skills-ml-vision-speech",
  "skills-backend-cloud",
];

const EXPERIENCE_CARDS = [
  "khs-research-assistant",
  "aura-ai",
  "testneo-api-generator",
  "bytical-ai",
  "profile-summary",
];

const english: GoldenQuestion[] = [
  // Recruiters and hiring managers
  { q: "Why should we hire Bhanu?", expect: ["profile-summary"], within: 3, lang: "en" },
  { q: "Who is Bhanu?", expect: ["profile-summary"], within: 3, lang: "en" },
  { q: "How many years of experience does he have?", expect: ["profile-summary"], within: 3, lang: "en" },
  { q: "Where is he based?", expect: ["profile-summary", "contact"], within: 3, lang: "en" },
  { q: "What is his current job?", expect: ["khs-research-assistant"], within: 3, lang: "en" },
  { q: "What did he do at Kendriya Hindi Sansthan?", expect: ["khs-research-assistant"], within: 1, lang: "en" },
  { q: "Does he have startup experience?", expect: ["aura-ai"], within: 3, lang: "en" },
  { q: "Where did he study?", expect: ["education"], within: 3, lang: "en" },
  { q: "What is his degree?", expect: ["education"], within: 3, lang: "en" },
  { q: "What is his educational background?", expect: ["education"], within: 3, lang: "en" },
  { q: "Does he have any certifications in cloud?", expect: ["certifications"], within: 3, lang: "en" },
  { q: "Did he win any awards?", expect: ["achievements", "conference-presentations"], within: 3, lang: "en" },
  { q: "Tell me about his publications", expect: ["publications"], within: 3, lang: "en" },
  { q: "Which languages does he speak?", expect: ["profile-summary"], within: 3, lang: "en" },
  { q: "What is his notice period?", expect: ["contact"], within: 3, lang: "en" },
  { q: "Is he open to remote work or relocation?", expect: ["contact"], within: 3, lang: "en" },
  { q: "How do I email him?", expect: ["contact"], within: 3, lang: "en" },

  // Engineers
  { q: "Show me his strongest RAG projects.", expect: ["hindi-semantic-search"], within: 3, lang: "en" },
  { q: "Which vector databases has he used?", expect: ["skills-genai-rag"], within: 3, lang: "en" },
  { q: "What LLMs has he worked with?", expect: ["skills-genai-rag"], within: 3, lang: "en" },
  { q: "Has he worked with LangChain?", expect: ["skills-genai-rag", "hindi-semantic-search", "testneo-api-generator", "sales-pitch-generator"], within: 3, lang: "en" },
  { q: "Does he know PyTorch?", expect: ["skills-genai-rag", "skills-ml-vision-speech"], within: 3, lang: "en" },
  { q: "Has he deployed on AWS?", expect: ["skills-backend-cloud"], within: 3, lang: "en" },
  { q: "What is his tech stack?", expect: ["skills-genai-rag", "skills-backend-cloud"], within: 3, lang: "en" },
  { q: "What is his experience with FastAPI?", expect: ["aura-ai", "skills-backend-cloud", "smart-hr-tool", "voice-ai-assistant"], within: 3, lang: "en" },
  { q: "Show me his computer vision work.", expect: ["aura-ai", "eye-disease-classification", "skills-ml-vision-speech", "bytical-ai"], within: 3, lang: "en" },
  { q: "Does he have any OCR experience?", expect: ["bytical-ai", "custom-document-ai-chatbot", "skills-ml-vision-speech"], within: 3, lang: "en" },
  { q: "Has he fine-tuned any models?", expect: ["eye-disease-classification"], within: 3, lang: "en" },
  { q: "Explain the ATAL AI architecture.", expect: ["atal-ai"], within: 1, lang: "en" },
  { q: "How did he build Aura AI?", expect: ["aura-ai"], within: 1, lang: "en" },
  { q: "Is this site using embeddings?", expect: ["this-copilot"], within: 3, lang: "en" },
  { q: "How does he evaluate retrieval quality?", expect: ["this-copilot", "hindi-semantic-search"], within: 3, lang: "en" },
  { q: "Has he trained neural networks?", expect: ["eye-disease-classification", "skills-ml-vision-speech"], within: 3, lang: "en" },
  { q: "Can he build mobile apps?", expect: ["aura-ai", "skills-backend-cloud"], within: 3, lang: "en" },

  // Founders
  { q: "Has he worked with real users?", expect: ["assam-field-research", "atal-ai", "khs-research-assistant"], within: 3, lang: "en" },
  // Not aura-ai: it is in development and not launched, so it is no answer here.
  { q: "Has he shipped anything to production?", expect: ["atal-ai", "khs-research-assistant", "assam-field-research"], within: 3, lang: "en" },
  { q: "Tell me about the makeup recommendation app.", expect: ["aura-ai"], within: 1, lang: "en" },
  { q: "What makes him different from other AI engineers?", expect: ["profile-summary"], within: 3, lang: "en" },
  { q: "Can he work with Indian languages?", expect: ["profile-summary", "atal-ai", "hindi-semantic-search", "bolchaal-hindi"], within: 3, lang: "en" },
];

const hindi: GoldenQuestion[] = [
  { q: "भानु ने हिंदी के लिए कौन-कौन से AI प्रोजेक्ट बनाए हैं?", expect: ["hindi-semantic-search", "bolchaal-hindi", "atal-ai"], within: 3, lang: "hi" },
  { q: "उनका अनुभव क्या है?", expect: EXPERIENCE_CARDS, within: 3, lang: "hi" },
  { q: "उन्होंने कहाँ पढ़ाई की?", expect: ["education"], within: 3, lang: "hi" },
  { q: "उनसे संपर्क कैसे करें?", expect: ["contact"], within: 3, lang: "hi" },
  { q: "उनके प्रकाशन कौन से हैं?", expect: ["publications"], within: 3, lang: "hi" },
  { q: "उनके कौशल क्या हैं?", expect: SKILL_CARDS, within: 3, lang: "hi" },
  { q: "हिंदी किताबों की खोज कैसे काम करती है?", expect: ["hindi-semantic-search"], within: 3, lang: "hi" },
  { q: "असम के स्कूलों में क्या हुआ?", expect: ["assam-field-research", "atal-ai"], within: 3, lang: "hi" },
];

const hinglish: GoldenQuestion[] = [
  { q: "Bhanu ne Hindi AI mein kya kaam kiya hai?", expect: ["hindi-semantic-search", "atal-ai", "bolchaal-hindi", "khs-research-assistant"], within: 3, lang: "hinglish" },
  { q: "unka anubhav kya hai?", expect: EXPERIENCE_CARDS, within: 3, lang: "hinglish" },
  { q: "padhai kahan se ki?", expect: ["education"], within: 3, lang: "hinglish" },
  { q: "sampark kaise karein?", expect: ["contact"], within: 3, lang: "hinglish" },
  { q: "Hindi kitab search kaise banaya?", expect: ["hindi-semantic-search"], within: 3, lang: "hinglish" },
  { q: "kya unhone koi award jeeta hai?", expect: ["achievements", "conference-presentations"], within: 3, lang: "hinglish" },
];

function dedupe(questions: GoldenQuestion[]): GoldenQuestion[] {
  const seen = new Set<string>();
  return questions.filter(({ q }) => {
    if (seen.has(q)) return false;
    seen.add(q);
    return true;
  });
}

export const goldenQuestions: GoldenQuestion[] = dedupe([
  ...cardPrompts,
  ...english,
  ...hindi,
  ...hinglish,
]);

/** Retrieval must return nothing for these. */
export const offTopicQuestions: string[] = [
  "What is the weather in Paris?",
  "Write me a poem about the sea",
  "salary of a doctor in Germany",
  "Who won the football world cup in 2022?",
  "Give me a recipe for chocolate cake",
  "How do I fix a flat bicycle tyre?",
  "What is the capital of Australia?",
  "Explain how airplanes fly",
  "आज मौसम कैसा है?",
  "ek chutkula sunao",
];

/**
 * First turns that do retrieve something. An off-topic second turn must still
 * return nothing: the follow-up rule may not hand it the opener's cards.
 */
export const onTopicOpeners: string[] = [
  "Tell me about ATAL AI",
  "How did he build Aura AI?",
  "Who is Bhanu?",
  "उनका अनुभव क्या है?",
  "unka anubhav kya hai?",
];

const SHOWN_ON_MISS = 3;

/**
 * Scores any ranker (the thread's user messages, oldest first → card ids,
 * best first) against the fixtures.
 */
export function evaluateRanker(rank: (messages: string[]) => string[]): RetrievalEval {
  const result: RetrievalEval = {
    total: goldenQuestions.length,
    hits: 0,
    misses: [],
    byLang: {
      en: { total: 0, hits: 0 },
      hi: { total: 0, hits: 0 },
      hinglish: { total: 0, hits: 0 },
    },
    offTopic: { total: offTopicQuestions.length, clean: 0 },
    offTopicFollowUp: { total: offTopicQuestions.length * onTopicOpeners.length, clean: 0 },
  };

  for (const { q, expect, within, lang } of goldenQuestions) {
    const ids = rank([q]);
    const hit = ids.slice(0, within).some((id) => expect.includes(id));
    result.byLang[lang].total += 1;
    if (hit) {
      result.hits += 1;
      result.byLang[lang].hits += 1;
    } else {
      result.misses.push({ q, expected: expect, got: ids.slice(0, SHOWN_ON_MISS) });
    }
  }

  for (const q of offTopicQuestions) {
    if (rank([q]).length === 0) {
      result.offTopic.clean += 1;
    }
    for (const opener of onTopicOpeners) {
      if (rank([opener, q]).length === 0) {
        result.offTopicFollowUp.clean += 1;
      }
    }
  }

  return result;
}

/** Runs the real retriever. Pure and cheap: the page renders its result. */
export function evaluateRetrieval(): RetrievalEval {
  return evaluateRanker((messages) =>
    retrieve({ userMessages: messages }).ranked.map(({ item }) => item.id),
  );
}
