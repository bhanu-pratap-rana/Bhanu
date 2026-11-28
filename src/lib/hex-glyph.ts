// The 7-cell honeycomb used as the copilot's mark (hero button and the
// floating launcher). It is a miniature of the 3D core: a centre cell and its
// six neighbours. Pure geometry and mapping, so it is testable without a DOM.

export const GLYPH_CELLS = 7;

/** Flat-top hexagon corner points around (cx, cy), as an SVG points string. */
export function hexPoints(cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    points.push(`${round(cx + r * Math.cos(a))},${round(cy + r * Math.sin(a))}`);
  }
  return points.join(" ");
}

/**
 * Centres of the 7 cells in a unit box (0..1 on both axes): the centre cell,
 * then its six neighbours clockwise from the top.
 */
export function glyphLayout(): { cx: number; cy: number; r: number }[] {
  // Flat-top neighbours sit at 30°, 90°, … from the centre, √3·R away.
  const r = 0.145;
  const step = Math.sqrt(3) * r * 1.1;
  const cells = [{ cx: 0.5, cy: 0.5, r }];
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (Math.PI / 3) * i;
    cells.push({ cx: round(0.5 + step * Math.cos(a)), cy: round(0.5 + step * Math.sin(a)), r });
  }
  return cells;
}

/**
 * Folds the core's per-note glow (26 notes) into the 7 glyph cells: each
 * note belongs to one cell (index mod 7) and a cell shows its brightest note.
 * Deterministic, so the glyph lights the same way the core does.
 */
export function glyphFromGlow(glow: ArrayLike<number>): number[] {
  const cells = new Array<number>(GLYPH_CELLS).fill(0);
  for (let i = 0; i < glow.length; i++) {
    const cell = i % GLYPH_CELLS;
    cells[cell] = Math.max(cells[cell], clamp01(glow[i] ?? 0));
  }
  return cells;
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
