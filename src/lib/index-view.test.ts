import { describe, expect, it } from "vitest";
import { deriveIndexView } from "./index-view";
import { starterQuestions } from "./knowledge";
import { RETRIEVAL_K } from "./rag";

const base = {
  draft: "",
  preview: null,
  questions: [],
  restQuestion: starterQuestions[0].question,
};

describe("deriveIndexView", () => {
  it("is never blank at rest: it previews the first starter question", () => {
    const view = deriveIndexView(base);
    expect(view.phase).toBe("rest");
    expect(view.question).toBe(starterQuestions[0].question);
    expect(view.ids.length).toBeGreaterThan(0);
    expect(view.ids.length).toBeLessThanOrEqual(RETRIEVAL_K);
  });

  it("previews every starter question with at least one note", () => {
    for (const { question } of starterQuestions) {
      const view = deriveIndexView({ ...base, preview: question });
      expect(view.phase).toBe("preview");
      expect(view.ids.length, question).toBeGreaterThan(0);
    }
  });

  it("never lights more than k notes while a question is being typed", () => {
    const question = "Which vector databases has he used in production RAG work?";
    for (let end = 1; end <= question.length; end += 1) {
      const view = deriveIndexView({ ...base, draft: question.slice(0, end) });
      expect(view.phase).toBe("typing");
      expect(view.ids.length, question.slice(0, end)).toBeLessThanOrEqual(
        RETRIEVAL_K,
      );
    }
  });

  it("gives the top match the strongest level and never level 0", () => {
    const view = deriveIndexView({ ...base, draft: "Aura AI computer vision " });
    expect(view.cells[view.ids[0]].level).toBe(3);
    for (const id of view.ids) {
      expect(view.cells[id].level).toBeGreaterThanOrEqual(1);
    }
  });

  it("a draft wins over a preview and over the last answer", () => {
    const view = deriveIndexView({
      ...base,
      draft: "publications",
      preview: starterQuestions[1].question,
      answer: { content: "x [1]", sources: ["aura-ai"] },
    });
    expect(view.phase).toBe("typing");
  });

  it("marks pulled notes and numbers the cited ones after an answer", () => {
    const view = deriveIndexView({
      ...base,
      answer: {
        content: "He built it on FastAPI [1] and published a chapter [3]. [9]",
        sources: ["aura-ai", "atal-ai", "publications"],
      },
    });
    expect(view.phase).toBe("pulled");
    expect(view.ids).toEqual(["aura-ai", "atal-ai", "publications"]);
    expect(view.cells["aura-ai"]).toMatchObject({ pulled: true, cite: 1 });
    expect(view.cells["atal-ai"]).toMatchObject({ pulled: true });
    expect(view.cells["atal-ai"].cite).toBeUndefined();
    expect(view.cells["publications"].cite).toBe(3);
    expect(view.citedCount).toBe(2);
  });

  it("reports an answer that pulled nothing", () => {
    const view = deriveIndexView({
      ...base,
      answer: { content: "That is not in his profile.", sources: [] },
    });
    expect(view.phase).toBe("pulled");
    expect(view.ids).toEqual([]);
  });
});
