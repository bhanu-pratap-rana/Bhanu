import { describe, expect, it } from "vitest";
import { NOTE_COUNT } from "./chat-store";
import { captionFor, moreReadLabel, splitSources } from "./index-caption";
import type { IndexView } from "./index-view";
import { knowledgeBase } from "./knowledge";

const ids = knowledgeBase.slice(0, 3).map((item) => item.id);

function view(phase: IndexView["phase"], n = ids.length): IndexView {
  const cells: IndexView["cells"] = {};
  ids.slice(0, n).forEach((id) => (cells[id] = { level: 2, pulled: phase === "pulled" }));
  return { phase, ids: ids.slice(0, n), cells, citedCount: 1 };
}

describe("captionFor, compact (one line)", () => {
  it("names a previewed question as that question, not the first one", () => {
    expect(captionFor(view("preview"), false, true)).toBe(
      `That question would read 3 of ${NOTE_COUNT} notes.`,
    );
  });

  it("describes the rest state as the first question", () => {
    expect(captionFor(view("rest"), false, true)).toBe(
      `The first question would read 3 of ${NOTE_COUNT} notes.`,
    );
  });

  it("counts while typing, and says so when nothing matches", () => {
    expect(captionFor(view("typing"), false, true)).toBe(
      `Would read 3 of ${NOTE_COUNT} notes.`,
    );
    expect(captionFor(view("typing", 0), false, true)).toBe(
      "No note matches those words yet.",
    );
  });

  it("never lists titles in compact mode", () => {
    for (const phase of ["rest", "preview", "typing"] as const) {
      expect(captionFor(view(phase), false, true)).not.toContain(":");
    }
  });
});

describe("captionFor, full", () => {
  it("reports the sources and how many were cited, in plain words", () => {
    expect(captionFor(view("pulled"), false, false)).toBe(
      `Answered from 3 of ${NOTE_COUNT} notes; 1 cited.`,
    );
    expect(captionFor(view("pulled"), true, false)).toBe(
      `Found 3 of ${NOTE_COUNT} notes. Reading them now.`,
    );
  });

  it("says plainly when no note matched", () => {
    expect(captionFor(view("pulled", 0), false, false)).toBe(
      "No note matched, so it answered from a one-line summary of each.",
    );
  });

  it("keeps retrieval jargon out of the answered captions", () => {
    for (const busy of [false, true]) {
      for (const n of [0, 3]) {
        const text = captionFor(view("pulled", n), busy, false);
        expect(text).not.toMatch(/\b(model|index|embedding|pulled)\b/i);
      }
    }
  });
});

describe("captionFor, plain words in every phase", () => {
  it("never says the copilot 'pulls' notes, nor uses retrieval jargon", () => {
    for (const phase of ["rest", "preview", "typing", "pulled"] as const) {
      for (const compact of [false, true]) {
        for (const n of [0, 3]) {
          const text = captionFor(view(phase, n), false, compact);
          expect(text).not.toMatch(/\b(pull|pulls|pulled|keywords?|index|embedding)\b/i);
        }
      }
    }
  });
});

describe("captionFor, a guard refusal", () => {
  it("says the question was declined, not that no note matched", () => {
    const declined: IndexView = { phase: "pulled", ids: [], cells: {}, citedCount: 0, declined: true };
    for (const compact of [true, false]) {
      const caption = captionFor(declined, false, compact);
      expect(caption).toMatch(/^Declined/);
      expect(caption).not.toMatch(/No note matched|summary/);
    }
  });
});

describe("splitSources", () => {
  it("shows only the cited sources, in order, and folds the rest", () => {
    expect(splitSources(6, [4, 1])).toEqual({ shown: [1, 4], more: [2, 3, 5, 6] });
  });

  it("ignores duplicate and out-of-range citations", () => {
    expect(splitSources(3, [2, 2, 0, 9])).toEqual({ shown: [2], more: [1, 3] });
  });

  it("folds every source when nothing is cited (yet)", () => {
    expect(splitSources(2, [])).toEqual({ shown: [], more: [1, 2] });
    expect(splitSources(0, [1])).toEqual({ shown: [], more: [] });
  });
});

describe("moreReadLabel", () => {
  it("counts the extra notes after the cited chips", () => {
    expect(moreReadLabel(2, 4)).toBe("+4 more read");
    expect(moreReadLabel(1, 1)).toBe("+1 more read");
  });

  it("names the notes plainly when none was cited", () => {
    expect(moreReadLabel(0, 1)).toBe("1 note read");
    expect(moreReadLabel(0, 5)).toBe("5 notes read");
  });

  it("is empty when there is nothing to fold", () => {
    expect(moreReadLabel(3, 0)).toBe("");
  });
});
