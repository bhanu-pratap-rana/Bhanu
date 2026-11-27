import { describe, expect, it } from "vitest";
import { NOTE_COUNT } from "./chat-store";
import { captionFor } from "./index-caption";
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
      `That question would pull 3 of ${NOTE_COUNT} notes.`,
    );
  });

  it("describes the rest state as the first question", () => {
    expect(captionFor(view("rest"), false, true)).toBe(
      `The first question would pull 3 of ${NOTE_COUNT} notes.`,
    );
  });

  it("counts while typing, and says so when nothing matches", () => {
    expect(captionFor(view("typing"), false, true)).toBe(
      `Would pull 3 of ${NOTE_COUNT} notes.`,
    );
    expect(captionFor(view("typing", 0), false, true)).toBe(
      "No note matches those keywords yet.",
    );
  });

  it("never lists titles in compact mode", () => {
    for (const phase of ["rest", "preview", "typing"] as const) {
      expect(captionFor(view(phase), false, true)).not.toContain(":");
    }
  });
});

describe("captionFor, full", () => {
  it("reports pulled and cited once answered", () => {
    expect(captionFor(view("pulled"), false, false)).toBe(
      `Pulled 3 of ${NOTE_COUNT} notes. The model cited 1.`,
    );
    expect(captionFor(view("pulled"), true, false)).toContain("Reading them now");
  });
});
