import { describe, expect, it } from "vitest";
import type { IndexView } from "./index-view";
import { knowledgeBase, starterQuestions } from "./knowledge";
import {
  demoFrames,
  glowTargets,
  isLit,
  sectionTargets,
} from "./scene-state";

const ids = knowledgeBase.map((item) => item.id);

function view(cells: IndexView["cells"], phase: IndexView["phase"]): IndexView {
  return { phase, ids: Object.keys(cells), cells, citedCount: 0 };
}

describe("glowTargets", () => {
  it("is dark everywhere at rest, so the demo owns the idle state", () => {
    const rest = view({ [ids[0]]: { level: 3, pulled: false } }, "rest");
    expect(glowTargets(rest, ids).every((g) => g === 0)).toBe(true);
  });

  it("ranks cited above pulled above match strength", () => {
    const v = view(
      {
        [ids[0]]: { level: 3, pulled: true, cite: 1 },
        [ids[1]]: { level: 3, pulled: true },
        [ids[2]]: { level: 3, pulled: false },
        [ids[3]]: { level: 1, pulled: false },
      },
      "pulled",
    );
    const g = glowTargets(v, ids);
    expect(g[0]).toBe(1);
    expect(g[1]).toBeLessThan(g[0]);
    expect(g[2]).toBeLessThan(g[1]);
    expect(g[3]).toBeLessThan(g[2]);
    expect(g[3]).toBeGreaterThan(0);
    expect(g.slice(4).every((x) => x === 0)).toBe(true);
  });

  it("returns one value per note, in note order", () => {
    const v = view({ [ids[5]]: { level: 2, pulled: false } }, "typing");
    const g = glowTargets(v, ids);
    expect(g).toHaveLength(ids.length);
    expect(g[5]).toBeGreaterThan(0);
  });
});

describe("sectionTargets", () => {
  const anchors = knowledgeBase.map((item) => item.anchor);

  it("lights every note that lives in the section on screen", () => {
    const s = sectionTargets("work", anchors);
    anchors.forEach((anchor, i) => {
      expect(s[i]).toBe(anchor.startsWith("work") ? 1 : 0);
    });
    expect(s.some((x) => x === 1)).toBe(true);
  });

  it("matches an exact anchor too, as on a project page", () => {
    const s = sectionTargets("work-atal-ai-2-0", anchors);
    expect(s.filter((x) => x === 1)).toHaveLength(
      anchors.filter((a) => a === "work-atal-ai-2-0").length,
    );
  });

  it("does not let a prefix leak across sections", () => {
    const s = sectionTargets("work-a", anchors);
    expect(s.every((x) => x === 0)).toBe(true);
  });

  it("is all dark with no section", () => {
    expect(sectionTargets(null, anchors).every((x) => x === 0)).toBe(true);
  });
});

describe("demoFrames", () => {
  it("retrieves each starter question with the real retriever", () => {
    const frames = demoFrames(starterQuestions.map((s) => s.question), ids);
    expect(frames).toHaveLength(starterQuestions.length);
    for (const frame of frames) {
      expect(frame.glow).toHaveLength(ids.length);
      expect(frame.count).toBe(frame.glow.filter(isLit).length);
      expect(frame.count).toBeGreaterThan(0);
    }
  });
});
