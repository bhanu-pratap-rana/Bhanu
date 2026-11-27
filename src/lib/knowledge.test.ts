import { describe, expect, it } from "vitest";
import { knowledgeBase } from "./knowledge";
import { tokenize } from "./rag";

describe("knowledge base labels", () => {
  it("gives every tag and alias at least one indexable word", () => {
    // A label made only of stop words ("about", "who", "won") is dropped by
    // the tokenizer, so it can never match and only misleads the reader.
    const dead = knowledgeBase.flatMap((item) =>
      [...item.tags, ...(item.aliases ?? [])]
        .filter((label) => tokenize(label).length === 0)
        .map((label) => `${item.id}: ${label}`),
    );
    expect(dead).toEqual([]);
  });
});
