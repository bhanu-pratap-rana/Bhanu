// What the 3D memory core shows, as plain numbers per note. Pure, so the
// rules are testable without a GPU:
// - glow (warm): the copilot touched the note — would pull, pulled, cited.
// - section (cool): the note lives in the part of the page being read.

import { deriveIndexView, type IndexView } from "./index-view";

const LEVEL_GLOW = [0, 0.28, 0.45, 0.62] as const;
const PULLED_GLOW = 0.8;

/** One glow value (0–1) per note, in `ids` order. Dark at rest. */
export function glowTargets(view: IndexView, ids: string[]): number[] {
  if (view.phase === "rest") return ids.map(() => 0);
  return ids.map((id) => {
    const cell = view.cells[id];
    if (!cell) return 0;
    if (cell.cite) return 1;
    if (cell.pulled) return PULLED_GLOW;
    return LEVEL_GLOW[cell.level];
  });
}

export function isLit(glow: number): boolean {
  return glow > 0;
}

/**
 * The hero's section id. The hero is the core's own stage, where the demo's
 * marigold tells the story; no cool section cell is lit there.
 */
const HERO_SECTION = "top";

/** 1 for every note whose anchor is the active section or inside it (none in the hero). */
export function sectionTargets(active: string | null, anchors: string[]): number[] {
  if (!active || active === HERO_SECTION) return anchors.map(() => 0);
  return anchors.map((anchor) =>
    anchor === active || anchor.startsWith(`${active}-`) ? 1 : 0,
  );
}

/**
 * What the core lights. Once something is asked it follows the copilot
 * everywhere; at rest the idle demo stands in, but only while the hero is
 * showing it, so elsewhere a page's own note is not outshone by a demo.
 */
export function coreGlow(
  view: IndexView,
  ids: string[],
  demoGlow: ArrayLike<number>,
  demoShowing: boolean,
): number[] {
  if (view.phase !== "rest") return glowTargets(view, ids);
  return ids.map((_, i) => (demoShowing ? (demoGlow[i] ?? 0) : 0));
}

/**
 * Frame-rate independent ease toward a target. With motion off it lands on
 * the target at once: pausing or reduced motion must never start a glide.
 */
export function approach(
  current: number,
  target: number,
  rate: number,
  dt: number,
  still = false,
): number {
  if (still) return target;
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export type DemoFrame = { question: string; glow: number[]; count: number };

/**
 * The idle demo: each starter question, run through the real retriever, as
 * the core would light it. Computed once; it never calls the model.
 */
export function demoFrames(questions: string[], ids: string[]): DemoFrame[] {
  return questions.map((question) => {
    const view = deriveIndexView({
      draft: "",
      preview: question,
      questions: [],
      restQuestion: question,
    });
    const glow = glowTargets(view, ids);
    return { question, glow, count: glow.filter(isLit).length };
  });
}
