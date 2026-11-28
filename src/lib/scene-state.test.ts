import { describe, expect, it } from "vitest";
import type { IndexView } from "./index-view";
import { knowledgeBase, starterQuestions } from "./knowledge";
import {
  approach,
  coreGlow,
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

  // The hero is the core's own stage: a lone cool cell among the demo's
  // marigold there reads as a glitch, not as "the section you are reading".
  it("lights nothing while the hero (#top) is the section on screen", () => {
    expect(anchors).toContain("top");
    expect(sectionTargets("top", anchors).every((x) => x === 0)).toBe(true);
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

describe("approach", () => {
  it("eases part of the way toward the target while motion is on", () => {
    const next = approach(0, 1, 6, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(1);
  });

  it("does not move without elapsed time", () => {
    expect(approach(0.2, 1, 6, 0)).toBe(0.2);
  });

  it("lands on the target at once with motion off, so pausing never animates", () => {
    expect(approach(0, 1, 6, 1 / 60, true)).toBe(1);
    expect(approach(3.2, 0.6, 3, 0, true)).toBe(0.6);
  });
});

describe("coreGlow", () => {
  const rest = view({}, "rest");
  const demo = ids.map((_, i) => (i === 0 ? 0.62 : 0));

  it("plays the idle demo at rest while the hero is showing it", () => {
    expect(coreGlow(rest, ids, demo, true)).toEqual(demo);
  });

  it("is dark at rest anywhere the demo is not showing, so a page's own note leads", () => {
    const g = coreGlow(rest, ids, demo, false);
    expect(g).toHaveLength(ids.length);
    expect(g.every((x) => x === 0)).toBe(true);
  });

  it("follows the copilot, not the demo, once something is asked", () => {
    const asked = view({ [ids[3]]: { level: 3, pulled: true, cite: 1 } }, "pulled");
    for (const showing of [true, false]) {
      const g = coreGlow(asked, ids, demo, showing);
      expect(g[3]).toBe(1);
      expect(g[0]).toBe(0);
    }
  });
});
