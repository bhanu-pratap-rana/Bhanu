import { knowledgeBase, type KnowledgeItem, type SourceRef } from "./knowledge";

export type ChatMode = "default" | "recruiter" | "architecture";

export function toSourceRefs(items: KnowledgeItem[]): SourceRef[] {
  return items.map(({ id, title, summary }) => ({ id, title, summary }));
}

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "for",
  "from",
  "has",
  "have",
  "he",
  "her",
  "his",
  "how",
  "i",
  "in",
  "is",
  "it",
  "me",
  "of",
  "on",
  "or",
  "show",
  "tell",
  "the",
  "to",
  "what",
  "why",
  "with",
  "you",
]);

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

export function retrieveKnowledge(query: string, limit = 5): KnowledgeItem[] {
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return knowledgeBase.slice(0, limit);
  }

  const scored = knowledgeBase.map((item) => {
    const haystack = tokenize(
      [item.title, item.summary, item.tags.join(" "), item.body].join(" "),
    );
    const haystackSet = new Set(haystack);
    const tokenScore = queryTokens.reduce(
      (score, token) => score + (haystackSet.has(token) ? 3 : 0),
      0,
    );
    const phraseScore = queryTokens.reduce((score, token) => {
      const text = `${item.title} ${item.summary} ${item.body}`.toLowerCase();
      return score + (text.includes(token) ? 1 : 0);
    }, 0);
    const tagScore = item.tags.reduce((score, tag) => {
      const normalized = tag.toLowerCase();
      return score + (query.toLowerCase().includes(normalized) ? 4 : 0);
    }, 0);

    return { item, score: tokenScore + phraseScore + tagScore };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .filter(({ score }) => score > 0)
    .slice(0, limit)
    .map(({ item }) => item);
}

export function buildGroundingContext(query: string, mode: ChatMode) {
  const retrieved = retrieveKnowledge(`${mode} ${query}`, 6);
  const compactKb = knowledgeBase
    .map((item) => `${item.title}: ${item.summary}`)
    .join("\n");
  const retrievedContext = retrieved
    .map(
      (item, index) =>
        `[${index + 1}] ${item.title} (${item.kind}; tags: ${item.tags.join(
          ", ",
        )})\n${item.body}`,
    )
    .join("\n\n");

  return {
    retrieved,
    context: `FULL PROFILE INDEX\n${compactKb}\n\nRETRIEVED EVIDENCE\n${retrievedContext}`,
  };
}

export function localAnswer(query: string, mode: ChatMode, sources: KnowledgeItem[]) {
  const sourceList = sources.length > 0 ? sources : knowledgeBase.slice(0, 4);
  const lower = query.toLowerCase();

  if (lower.includes("interview")) {
    return `Here are interview questions grounded in Bhanu's profile:\n\n1. How did you design the RAG workflow for the Hindi Semantic Search System?\n2. What tradeoffs did you make while using Groq and ChromaDB for API test generation?\n3. Walk me through the FastAPI, Redis, Celery, and PostgreSQL architecture in Aura AI.\n4. How did your Assam field study data influence ATAL AI product decisions?\n5. How would you evaluate answer quality in a recruiter-facing RAG chatbot?\n6. What computer vision steps power facial analysis and skin tone detection in Aura AI?\n7. How do you handle document ingestion across PDF, DOCX, OpenAPI, and TXT sources?\n8. What would you improve first if scaling ATAL AI to more schools?\n9. How do you balance LLM latency, cost, and answer quality in public AI products?\n10. Which project best demonstrates your production engineering judgment, and why?`;
  }

  if (mode === "architecture" || lower.includes("architecture")) {
    const target = sourceList[0];
    return `${target.title} architecture, based on the available profile data:\n\nUser experience layer -> Next.js/React Native or PWA interface -> FastAPI service layer -> retrieval and AI orchestration -> PostgreSQL/Supabase for structured data -> vector search for document grounding -> Redis/Celery for async processing where needed -> LLM or computer vision model for generation/analysis.\n\nThe strongest example is Aura AI: React Native connects to FastAPI, FastAPI coordinates PostgreSQL, Redis, Celery, Dockerized workers, OpenCV/MediaPipe pipelines, and a GPT-4o assistant.`;
  }

  if (lower.includes("hire") || mode === "recruiter") {
    return `Bhanu is a strong fit for applied AI roles because he has shipped across the full AI product stack: RAG systems, FastAPI backends, vector search, computer vision, OCR, dashboards, and production-oriented automation.\n\nThe clearest proof points are ATAL AI at Kendriya Hindi Sansthan, Aura AI's FastAPI/Redis/Celery/PostgreSQL architecture, and the Groq + ChromaDB API Test Case Generator. He also brings field research experience from 570+ students across 6 schools, which is useful because he connects model work to real users and measurable adoption.`;
  }

  return `Based on the most relevant profile evidence: ${sourceList
    .slice(0, 3)
    .map((item) => `${item.title} - ${item.summary}`)
    .join("\n\n")}\n\nIn short, Bhanu's profile centers on production-grade applied AI: RAG, FastAPI, computer vision, AI automation, document intelligence, and education-focused AI systems.`;
}
