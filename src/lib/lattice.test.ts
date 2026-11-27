import { describe, expect, it } from "vitest";
import { kagomeLayout } from "./lattice";

const dist = (a: { cx: number; cy: number }, b: { cx: number; cy: number }) =>
  Math.hypot(a.cx - b.cx, a.cy - b.cy);

function vertices(points: string): [number, number][] {
  return points.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return [x, y];
  });
}

describe("kagomeLayout", () => {
  it("places exactly the requested number of cells", () => {
    expect(kagomeLayout(24, 7).cells).toHaveLength(24);
    expect(kagomeLayout(1, 7).cells).toHaveLength(1);
    expect(kagomeLayout(0, 7).cells).toHaveLength(0);
  });

  it("alternates full rows and rows one cell shorter", () => {
    const { cells, rows } = kagomeLayout(26, 7);
    const perRow = Array.from({ length: rows }, (_, row) =>
      cells.filter((cell) => cell.row === row).length,
    );
    expect(perRow).toEqual([7, 6, 7, 6]);
  });

  it("gives every cell a six-vertex hexagon of circumradius a", () => {
    const a = 10;
    const [cell] = kagomeLayout(1, 7, a).cells;
    const points = vertices(cell.points);
    expect(points).toHaveLength(6);
    for (const [x, y] of points) {
      expect(Math.hypot(x - cell.cx, y - cell.cy)).toBeCloseTo(a, 1);
    }
  });

  it("spaces neighbours 2a apart so hexagons touch at a single vertex", () => {
    const a = 10;
    const { cells } = kagomeLayout(26, 7, a);
    const at = (row: number, col: number) =>
      cells.find((cell) => cell.row === row && cell.col === col)!;

    // Same row.
    expect(dist(at(0, 0), at(0, 1))).toBeCloseTo(2 * a, 5);
    // Row below, both diagonal neighbours.
    expect(dist(at(0, 1), at(1, 0))).toBeCloseTo(2 * a, 1);
    expect(dist(at(0, 1), at(1, 1))).toBeCloseTo(2 * a, 1);

    const shared = vertices(at(0, 1).points).filter(([x, y]) =>
      vertices(at(1, 1).points).some(
        ([x2, y2]) => Math.hypot(x - x2, y - y2) < 0.05,
      ),
    );
    expect(shared).toHaveLength(1);
  });

  it("keeps every vertex inside the reported bounds", () => {
    const { cells, width, height } = kagomeLayout(26, 7, 10);
    for (const cell of cells) {
      for (const [x, y] of vertices(cell.points)) {
        expect(x).toBeGreaterThanOrEqual(-0.01);
        expect(x).toBeLessThanOrEqual(width + 0.01);
        expect(y).toBeGreaterThanOrEqual(-0.01);
        expect(y).toBeLessThanOrEqual(height + 0.01);
      }
    }
  });

  it("is deterministic so server and client render the same markup", () => {
    expect(kagomeLayout(24, 7, 12)).toEqual(kagomeLayout(24, 7, 12));
  });
});
