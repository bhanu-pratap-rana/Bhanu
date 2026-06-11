import { describe, expect, it } from "vitest";
import {
  buildGroundingContext,
  retrieveKnowledge,
  toSourceRefs,
} from "./rag";

describe("retrieveKnowledge", () => {
  it("ranks the most relevant card first for a project query", () => {
    const results = retrieveKnowledge("How did he build Aura AI?");
    expect(results[0]?.id).toBe("aura-ai");
  });

  it("surfaces RAG projects for a RAG query", () => {
    const ids = retrieveKnowledge("show me his strongest RAG projects").map(
      (item) => item.id,
    );
    expect(ids).toContain("hindi-semantic-search");
  });

  it("falls back to leading cards when the query has no usable tokens", () => {
    const results = retrieveKnowledge("the a an");
    expect(results.length).toBeGreaterThan(0);
  });

  it("respects the limit argument", () => {
    expect(retrieveKnowledge("AI engineer", 3).length).toBeLessThanOrEqual(3);
  });
});

describe("buildGroundingContext", () => {
  it("includes the full profile index and retrieved evidence", () => {
    const { context, retrieved } = buildGroundingContext("Aura AI", "default");
    expect(context).toContain("FULL PROFILE INDEX");
    expect(context).toContain("RETRIEVED EVIDENCE");
    expect(retrieved.length).toBeGreaterThan(0);
  });
});

describe("toSourceRefs", () => {
  it("keeps only id, title, and summary", () => {
    const [first] = retrieveKnowledge("Aura AI");
    const [ref] = toSourceRefs([first]);
    expect(ref).toEqual({
      id: first.id,
      title: first.title,
      summary: first.summary,
    });
    expect(ref).not.toHaveProperty("body");
    expect(ref).not.toHaveProperty("tags");
  });
});
