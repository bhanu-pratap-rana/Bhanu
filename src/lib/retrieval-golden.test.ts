import { describe, expect, it } from "vitest";
import { knowledgeBase, starterQuestions } from "./knowledge";
import {
  evaluateRetrieval,
  goldenQuestions,
  offTopicQuestions,
} from "./retrieval-golden";

describe("golden questions", () => {
  const byLang = (lang: string) => goldenQuestions.filter((entry) => entry.lang === lang);

  it("covers English, Hindi and Hinglish", () => {
    expect(byLang("en").length).toBeGreaterThanOrEqual(26);
    expect(byLang("hi").length).toBeGreaterThanOrEqual(6);
    expect(byLang("hinglish").length).toBeGreaterThanOrEqual(4);
    expect(offTopicQuestions.length).toBeGreaterThanOrEqual(6);
  });

  it("includes every starter question and every card's own prompt", () => {
    const asked = new Set(goldenQuestions.map((entry) => entry.q));
    for (const { question } of starterQuestions) {
      expect(asked.has(question), question).toBe(true);
    }
    for (const { prompt } of knowledgeBase) {
      expect(asked.has(prompt), prompt).toBe(true);
    }
  });

  it("keeps the questions the retriever was rebuilt against", () => {
    const expected = new Map(goldenQuestions.map((entry) => [entry.q, entry]));
    const required: [string, string, 1 | 3][] = [
      ["Why should we hire Bhanu?", "profile-summary", 3],
      ["Show me his strongest RAG projects.", "hindi-semantic-search", 3],
      ["Where did he study?", "education", 3],
      ["What is his degree?", "education", 3],
      ["What is his current job?", "khs-research-assistant", 3],
      ["Does he know PyTorch?", "skills-genai-rag", 3],
      ["Has he deployed on AWS?", "skills-backend-cloud", 3],
      ["What is his notice period?", "contact", 3],
      ["How do I email him?", "contact", 3],
      ["Which vector databases has he used?", "skills-genai-rag", 3],
      ["Show me his computer vision work.", "aura-ai", 3],
      ["Tell me about his publications", "publications", 3],
      ["Explain the ATAL AI architecture.", "atal-ai", 1],
      ["How did he build Aura AI?", "aura-ai", 1],
      ["What did he build at Testneo?", "testneo-api-generator", 1],
      ["भानु ने हिंदी के लिए कौन-कौन से AI प्रोजेक्ट बनाए हैं?", "hindi-semantic-search", 3],
      ["उनका अनुभव क्या है?", "khs-research-assistant", 3],
      ["उन्होंने कहाँ पढ़ाई की?", "education", 3],
      ["उनसे संपर्क कैसे करें?", "contact", 3],
      ["उनके प्रकाशन कौन से हैं?", "publications", 3],
      ["उनके कौशल क्या हैं?", "skills-genai-rag", 3],
      ["Bhanu ne Hindi AI mein kya kaam kiya hai?", "hindi-semantic-search", 3],
      ["unka anubhav kya hai?", "khs-research-assistant", 3],
      ["padhai kahan se ki?", "education", 3],
      ["sampark kaise karein?", "contact", 3],
    ];
    for (const [question, id, within] of required) {
      const entry = expected.get(question);
      expect(entry, question).toBeDefined();
      expect(entry!.expect, question).toContain(id);
      expect(entry!.within, question).toBe(within);
    }
  });

  it("asks each question once and only expects cards that exist", () => {
    const questions = goldenQuestions.map((entry) => entry.q);
    expect(new Set(questions).size).toBe(questions.length);
    const ids = new Set(knowledgeBase.map((item) => item.id));
    for (const { q, expect: expected } of goldenQuestions) {
      expect(expected.length, q).toBeGreaterThan(0);
      for (const id of expected) {
        expect(ids.has(id), `${q} → ${id}`).toBe(true);
      }
    }
  });

  it("writes Hindi in Devanagari and Hinglish in Roman script", () => {
    for (const { q } of byLang("hi")) {
      expect(q).toMatch(/[ऀ-ॿ]/);
    }
    for (const { q } of byLang("hinglish")) {
      expect(q).not.toMatch(/[ऀ-ॿ]/);
    }
  });
});

describe("evaluateRetrieval", () => {
  const result = evaluateRetrieval();

  it("prints the score and every miss", () => {
    const { total, hits, byLang, offTopic, misses } = result;
    console.log(
      [
        `retrieval: ${hits}/${total}`,
        `en ${byLang.en.hits}/${byLang.en.total}`,
        `hi ${byLang.hi.hits}/${byLang.hi.total}`,
        `hinglish ${byLang.hinglish.hits}/${byLang.hinglish.total}`,
        `off-topic clean ${offTopic.clean}/${offTopic.total}`,
      ].join(" | "),
    );
    for (const miss of misses) {
      console.log(
        `MISS ${miss.q}\n  expected: ${miss.expected.join(", ")}\n  got: ${miss.got.join(", ") || "(nothing)"}`,
      );
    }
    expect(total).toBe(goldenQuestions.length);
    expect(hits + misses.length).toBe(total);
    expect(byLang.en.total + byLang.hi.total + byLang.hinglish.total).toBe(total);
  });

  it("puts the right card in view for at least 90% of the questions", () => {
    expect(result.hits / result.total).toBeGreaterThanOrEqual(0.9);
  });

  it("holds the Hindi and Hinglish floors", () => {
    const { hi, hinglish } = result.byLang;
    expect(hi.hits / hi.total).toBeGreaterThanOrEqual(5 / 6);
    expect(hinglish.hits / hinglish.total).toBeGreaterThanOrEqual(3 / 4);
  });

  it("retrieves nothing for every off-topic question", () => {
    expect(result.offTopic.clean).toBe(result.offTopic.total);
  });

  it("is deterministic", () => {
    expect(evaluateRetrieval()).toEqual(result);
  });
});
