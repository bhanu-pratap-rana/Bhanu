// Geometry of the 3D memory core: one hexagonal prism per note, laid out on
// a flat-topped hex grid that spirals out from the centre, ring by ring.
// Notes go in page order, so a section's notes sit together on the grid.

export type Axial = { q: number; r: number };

const DIRECTIONS: Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

/** Grid distance from the centre cell. */
export function ringOf({ q, r }: Axial): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

/** The first `count` cells of a hex spiral: the centre, then each ring in turn. */
export function hexSpiral(count: number): Axial[] {
  const cells: Axial[] = [];
  if (count <= 0) return cells;
  cells.push({ q: 0, r: 0 });

  for (let ring = 1; cells.length < count; ring++) {
    let cell: Axial = { q: DIRECTIONS[4].q * ring, r: DIRECTIONS[4].r * ring };
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < ring; step++) {
        if (cells.length === count) return cells;
        cells.push(cell);
        cell = { q: cell.q + DIRECTIONS[side].q, r: cell.r + DIRECTIONS[side].r };
      }
    }
  }
  return cells;
}

/** Centre of a flat-topped hexagon of circumradius `size`, on the ground plane. */
export function axialToWorld({ q, r }: Axial, size: number): { x: number; z: number } {
  // `+ 0` turns -0 into 0, so the centre is exactly the origin.
  return {
    x: size * 1.5 * q + 0,
    z: size * Math.sqrt(3) * (r + q / 2) + 0,
  };
}

/** The page section that holds a note: "work-atal-ai-2-0" lives in "work". */
export function sectionOfAnchor(anchor: string): string {
  return anchor.split("-")[0];
}
