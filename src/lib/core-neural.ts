// The memory core's neural layer, the core's final look (hero and copilot
// dock alike): the question orb is the input node, a ring of hidden nodes
// sits below it, and the prisms are the outputs. Pure topology and timing,
// so the renderer (core-renderer.ts) only draws what this decides and
// allocates nothing.
//
// On by default. `?core=classic` brings back the earlier direct threads
// (orb -> prism) for side-by-side comparison only; nothing on the site links
// to it.

import { ORB_HEIGHT } from "./core-stage";

export const NEURAL = {
  /** Hidden nodes on the ring. */
  HIDDEN: 7,
  /** The ring's height, as a fraction of the orb's. */
  HEIGHT_FRAC: 0.6,
  /** The ring's radius, world units (the cluster's outer ring is ~5.2 out). */
  RING_R: 2.8,
  /** A hidden node's sphere radius, world units. */
  NODE_R: 0.14,
  /** Hidden nodes each prism connects to. */
  FAN_IN: 2,
  /** One hop of a signal (orb -> hidden, hidden -> prism), seconds. */
  HOP_S: 0.28,
  /** Delay between the hidden nodes' first hops, seconds. */
  HIDDEN_STAGGER_S: 0.02,
  /** Spread of the prisms' second hops after their node is reached, seconds. */
  PRISM_STAGGER_S: 0.05,
  /** An idle pulse runs this long after the last burst began, seconds. */
  IDLE_PERIOD_S: 4,
  /** An idle pulse's brightness against a question's. */
  IDLE_STRENGTH: 0.5,
  /** How fast a node's flash settles after a signal reaches it, seconds. */
  AFTERGLOW_S: 0.18,
} as const;

/** False only for `?core=classic` (exact, case-sensitive); true otherwise. */
export function neuralFromSearch(search: string): boolean {
  try {
    return new URLSearchParams(search).get("core") !== "classic";
  } catch {
    return true;
  }
}

/** The hidden nodes' world positions, x y z per node, evenly round the axis. */
export function hiddenLayer(
  count: number = NEURAL.HIDDEN,
  orbHeight = ORB_HEIGHT,
  ringR: number = NEURAL.RING_R,
): Float32Array {
  const out = new Float32Array(count * 3);
  const y = orbHeight * NEURAL.HEIGHT_FRAC;
  for (let j = 0; j < count; j++) {
    // A quarter turn off the x axis, so no node sits straight over a row.
    const a = (j / count) * Math.PI * 2 + Math.PI / (2 * count);
    out[j * 3] = Math.cos(a) * ringR;
    out[j * 3 + 1] = y;
    out[j * 3 + 2] = Math.sin(a) * ringR;
  }
  return out;
}

/**
 * For each cell, the `k` hidden nodes nearest to it in the ground plane,
 * nearest first (ties: lower index first). k per cell, flat.
 */
export function nearestHidden(
  cells: readonly { x: number; z: number }[],
  hidden: Float32Array,
  k: number = NEURAL.FAN_IN,
): Int32Array {
  const n = hidden.length / 3;
  const out = new Int32Array(cells.length * k);
  const order = Array.from({ length: n }, (_, j) => j);
  cells.forEach((cell, i) => {
    const d = (j: number) => Math.hypot(cell.x - hidden[j * 3], cell.z - hidden[j * 3 + 2]);
    const sorted = [...order].sort((a, b) => d(a) - d(b) || a - b);
    for (let m = 0; m < k; m++) out[i * k + m] = sorted[m];
  });
  return out;
}

/** Progress (0..1) of a hop that starts at `delay`, at burst time `t`; -1 before it starts or once it is done. */
export function hop(t: number, delay: number, duration: number = NEURAL.HOP_S): number {
  const u = (t - delay) / duration;
  return u >= 0 && u < 1 ? u : -1;
}

/** When the orb's signal reaches hidden node `j`, burst seconds. */
export function hiddenArrival(j: number): number {
  return j * NEURAL.HIDDEN_STAGGER_S + NEURAL.HOP_S;
}

/** A fixed spread per prism (0..1), so prisms fire in a staggered order. */
function prismSeed(i: number): number {
  return (i * 0.6180339887) % 1;
}

/** When the signal from hidden node `j` to prism `i` leaves the node, burst seconds. */
export function prismHopDelay(i: number, j: number): number {
  return hiddenArrival(j) + prismSeed(i) * NEURAL.PRISM_STAGGER_S;
}

/** The whole burst, burst seconds: the last node's arrival, the widest spread, a hop. */
export function burstLength(): number {
  return hiddenArrival(NEURAL.HIDDEN - 1) + NEURAL.PRISM_STAGGER_S + NEURAL.HOP_S;
}

/** A travelling point's brightness at hop progress `u` (-1: not travelling). */
export function signalAlpha(u: number): number {
  if (u < 0 || u >= 1) return 0;
  return Math.min(1, 0.3 + u * 7, (1 - u) * 8);
}

/** A node's flash `dt` seconds after a signal reached it: 1 on arrival, settling to 0. */
export function afterglow(dt: number): number {
  return dt < 0 ? 0 : Math.exp(-dt / NEURAL.AFTERGLOW_S);
}

/** An idle pulse is due: the period has passed since the last burst began. */
export function idleBurstDue(lastStart: number, now: number): boolean {
  return now - lastStart >= NEURAL.IDLE_PERIOD_S;
}
