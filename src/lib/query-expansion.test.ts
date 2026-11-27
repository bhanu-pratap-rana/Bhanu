import { describe, expect, it } from "vitest";
import { expandToken, expansions, foldDevanagari } from "./query-expansion";
import { isIndexed, tokenize } from "./rag";

describe("expansions table", () => {
  it("stays a small, reviewable list", () => {
    const size = Object.keys(expansions).length;
    expect(size).toBeGreaterThanOrEqual(50);
    expect(size).toBeLessThanOrEqual(80);
  });

  it("has no dead entries: every target is a term in the card index", () => {
    const dead = Object.entries(expansions).flatMap(([word, terms]) =>
      terms.filter((term) => !isIndexed(term)).map((term) => `${word} → ${term}`),
    );
    expect(dead).toEqual([]);
  });

  it("has no key the tokenizer would drop or split", () => {
    const unreachable = Object.keys(expansions).filter(
      (word) => tokenize(word).length !== 1,
    );
    expect(unreachable).toEqual([]);
  });

  it("keeps keys lower-case", () => {
    for (const word of Object.keys(expansions)) {
      expect(word).toBe(word.toLowerCase());
    }
  });
});

describe("expandToken", () => {
  it("maps Hindi section words to English index terms", () => {
    expect(expandToken("अनुभव")).toEqual({ terms: ["experience"], from: "अनुभव" });
    expect(expandToken("प्रकाशन").terms).toEqual(["publications"]);
    expect(expandToken("संपर्क").terms).toEqual(["contact", "email"]);
  });

  it("maps Hinglish and English synonyms through the same table", () => {
    expect(expandToken("anubhav").terms).toEqual(["experience"]);
    expect(expandToken("padhai").terms).toEqual(["education"]);
    expect(expandToken("study").terms).toEqual(["education"]);
    expect(expandToken("job").terms).toEqual(["experience", "role"]);
  });

  it("returns an unlisted word unchanged, with no `from`", () => {
    expect(expandToken("fastapi")).toEqual({ terms: ["fastapi"] });
  });

  it("recognises the owner's name and gives it no terms", () => {
    expect(expandToken("भानु")).toEqual({ terms: [], from: "भानु" });
  });

  it("accepts both spellings of हिंदी", () => {
    expect(expandToken("हिंदी").terms).toEqual(["hindi"]);
    expect(expandToken("हिन्दी").terms).toEqual(["hindi"]);
  });

  it("accepts nukta, chandrabindu and half-nasal variants", () => {
    // आवाज़ with a combining nukta, with the precomposed letter, and without.
    expect(expandToken("आवाज\u093c").terms).toEqual(["voice"]);
    expect(expandToken("आवा\u095b").terms).toEqual(["voice"]);
    expect(expandToken("आवाज").terms).toEqual(["voice"]);
    expect(expandToken("पढाई").terms).toEqual(["education"]);
    expect(expandToken("सम्पर्क").terms).toEqual(["contact", "email"]);
  });

  it("accepts Hindi plural and oblique forms", () => {
    expect(expandToken("किताबों").terms).toEqual(["books"]);
    expect(expandToken("किताबें").terms).toEqual(["books"]);
    expect(expandToken("स्कूलों").terms).toEqual(["schools"]);
    expect(expandToken("परियोजनाओं").terms).toEqual(["project"]);
    expect(expandToken("प्रोजेक्ट्स").terms).toEqual(["project"]);
  });

  it("does not return the table's own array", () => {
    expandToken("study").terms.push("mutated");
    expect(expandToken("study").terms).toEqual(["education"]);
  });
});

describe("foldDevanagari", () => {
  it("leaves non-Devanagari text alone", () => {
    expect(foldDevanagari("résumé")).toBe("résumé");
  });

  it("folds spelling variants onto one key", () => {
    expect(foldDevanagari("हिन्दी")).toBe(foldDevanagari("हिंदी"));
    expect(foldDevanagari("कहाँ")).toBe(foldDevanagari("कहां"));
  });
});
