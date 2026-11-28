import { describe, expect, it } from "vitest";
import { GLYPH_CELLS, glyphFromGlow, glyphLayout, hexPoints } from "./hex-glyph";

describe("hexPoints", () => {
  it("draws a flat-top hexagon: six corners, two on the horizontal axis", () => {
    const pts = hexPoints(10, 10, 5).split(" ").map((p) => p.split(",").map(Number));
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual([15, 10]);
    expect(pts[3]).toEqual([5, 10]);
  });
});

describe("glyphLayout", () => {
  it("has a centre cell and six neighbours that stay inside the box", () => {
    const cells = glyphLayout();
    expect(cells).toHaveLength(GLYPH_CELLS);
    expect(cells[0]).toMatchObject({ cx: 0.5, cy: 0.5 });
    for (const c of cells) {
      expect(c.cx - c.r).toBeGreaterThanOrEqual(0);
      expect(c.cx + c.r).toBeLessThanOrEqual(1);
      expect(c.cy - c.r).toBeGreaterThanOrEqual(0);
      expect(c.cy + c.r).toBeLessThanOrEqual(1);
    }
  });

  it("never overlaps neighbouring cells", () => {
    const [centre, ...ring] = glyphLayout();
    for (const c of ring) {
      const d = Math.hypot(c.cx - centre.cx, c.cy - centre.cy);
      // Flat-to-flat width of a flat-top hexagon is √3·r.
      expect(d).toBeGreaterThan(Math.sqrt(3) * c.r);
    }
  });
});

describe("glyphFromGlow", () => {
  it("is dark when nothing is lit", () => {
    expect(glyphFromGlow(new Float32Array(26))).toEqual(new Array(7).fill(0));
  });

  it("folds notes into cells by index mod 7, keeping the brightest", () => {
    const glow = new Float32Array(26);
    glow[3] = 0.4;
    glow[10] = 0.9; // also cell 3
    glow[25] = 1; // cell 4
    const cells = glyphFromGlow(glow);
    expect(cells[3]).toBeCloseTo(0.9);
    expect(cells[4]).toBe(1);
    expect(cells.filter((c) => c > 0)).toHaveLength(2);
  });

  it("clamps junk values", () => {
    expect(glyphFromGlow([Number.NaN, 2, -1])).toEqual([0, 1, 0, 0, 0, 0, 0]);
  });
});
