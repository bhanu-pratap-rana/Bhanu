// Geometry for the index lattice: a kagome (trihexagonal) tiling, the
// star-and-hexagon grid of a Mughal jali screen. Flat-top hexagons sit on a
// triangular lattice 2a apart, so neighbours touch at one vertex and the gaps
// between them are triangles. Pure and deterministic: the same call on the
// server and in the browser yields identical markup.

export type LatticeCell = {
  index: number;
  row: number;
  col: number;
  cx: number;
  cy: number;
  /** SVG `points` for the hexagon outline. */
  points: string;
};

export type LatticeLayout = {
  cells: LatticeCell[];
  rows: number;
  width: number;
  height: number;
};

const SQRT3 = Math.sqrt(3);
const round = (value: number) => Math.round(value * 100) / 100;

function hexagon(cx: number, cy: number, a: number): string {
  return Array.from({ length: 6 }, (_, corner) => {
    const angle = (Math.PI / 3) * corner;
    return `${round(cx + a * Math.cos(angle))},${round(cy + a * Math.sin(angle))}`;
  }).join(" ");
}

/**
 * Lays out `count` cells in rows that alternate between `cols` cells and
 * `cols - 1` cells (the shorter rows sit half a step in).
 */
export function kagomeLayout(count: number, cols: number, a = 10): LatticeLayout {
  const cells: LatticeCell[] = [];
  const rowPitch = a * SQRT3;
  let row = 0;

  while (cells.length < count) {
    const short = row % 2 === 1;
    const inRow = short ? Math.max(cols - 1, 1) : cols;
    for (let col = 0; col < inRow && cells.length < count; col += 1) {
      const cx = round(a + col * 2 * a + (short ? a : 0));
      const cy = round(rowPitch / 2 + row * rowPitch);
      cells.push({
        index: cells.length,
        row,
        col,
        cx,
        cy,
        points: hexagon(cx, cy, a),
      });
    }
    row += 1;
  }

  return {
    cells,
    rows: row,
    width: round(cols * 2 * a),
    height: round(row * rowPitch),
  };
}
