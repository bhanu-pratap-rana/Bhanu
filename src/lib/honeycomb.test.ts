import { describe, expect, it } from "vitest";
import { axialToWorld, hexSpiral, ringOf, sectionOfAnchor } from "./honeycomb";

const key = ({ q, r }: { q: number; r: number }) => `${q},${r}`;

function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

describe("hexSpiral", () => {
  it("starts at the centre and returns exactly count unique cells", () => {
    const cells = hexSpiral(26);
    expect(cells).toHaveLength(26);
    expect(cells[0]).toEqual({ q: 0, r: 0 });
    expect(new Set(cells.map(key)).size).toBe(26);
  });

  it("fills ring by ring: 1, then 6, then 12", () => {
    const cells = hexSpiral(26);
    expect(cells.slice(1, 7).every((c) => ringOf(c) === 1)).toBe(true);
    expect(cells.slice(7, 19).every((c) => ringOf(c) === 2)).toBe(true);
    expect(cells.slice(19).every((c) => ringOf(c) === 3)).toBe(true);
  });

  it("walks each ring so neighbours in the list are neighbours on the grid", () => {
    const cells = hexSpiral(37);
    for (let i = 2; i < cells.length; i++) {
      if (ringOf(cells[i]) !== ringOf(cells[i - 1])) continue;
      expect(hexDistance(cells[i], cells[i - 1])).toBe(1);
    }
  });

  it("handles zero and one", () => {
    expect(hexSpiral(0)).toEqual([]);
    expect(hexSpiral(1)).toEqual([{ q: 0, r: 0 }]);
  });
});

describe("axialToWorld", () => {
  it("puts the centre at the origin", () => {
    expect(axialToWorld({ q: 0, r: 0 }, 1)).toEqual({ x: 0, z: 0 });
  });

  it("keeps every pair of grid neighbours the same distance apart", () => {
    const size = 1;
    const origin = axialToWorld({ q: 0, r: 0 }, size);
    const neighbours = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ];
    for (const n of neighbours) {
      const p = axialToWorld(n, size);
      expect(Math.hypot(p.x - origin.x, p.z - origin.z)).toBeCloseTo(
        Math.sqrt(3) * size,
        6,
      );
    }
  });
});

describe("sectionOfAnchor", () => {
  it("maps note anchors to the page section that holds them", () => {
    expect(sectionOfAnchor("work-atal-ai-2-0")).toBe("work");
    expect(sectionOfAnchor("experience-khs")).toBe("experience");
    expect(sectionOfAnchor("skills")).toBe("skills");
    expect(sectionOfAnchor("top")).toBe("top");
  });
});

describe("project notes", () => {
  it("every listed project points at a note the core can light", async () => {
    const { projects, knowledgeBase } = await import("./knowledge");
    const ids = new Set(knowledgeBase.map((item) => item.id));
    for (const project of projects) {
      expect(ids.has(project.kbId), project.slug).toBe(true);
    }
  });
});
