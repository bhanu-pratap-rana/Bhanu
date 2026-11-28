// The floating launcher's rules, kept free of the DOM so they can be tested:
// what it says, when it shows, when its label chip shows, how its glyph is
// lit, and how its glyph flies in from the hero's CTA.

/** The launcher's accessible name. It never changes with the state. */
export const LAUNCHER_NAME = "Ask my copilot";

/** idle: nothing asked; busy: answering; ready: an answer waits unseen; open. */
export type LauncherMode = "idle" | "busy" | "ready" | "open";

// The capsule is the button's only visible label, so every label starts with
// the accessible name (WCAG 2.5.3 Label in Name): "click Ask my copilot"
// works by voice in every state.
const LABELS: Record<LauncherMode, string> = {
  idle: LAUNCHER_NAME,
  busy: `${LAUNCHER_NAME} · answering…`,
  ready: `${LAUNCHER_NAME} · answer ready`,
  open: LAUNCHER_NAME,
};

// Read after the name (aria-describedby), so a screen reader hears the state
// without the name changing under it.
const DESCRIPTIONS: Record<LauncherMode, string> = {
  idle: "",
  busy: "Answering now.",
  ready: "An answer is ready.",
  open: "",
};

export function launcherView({
  open,
  busy,
  unseenAnswer,
}: {
  open: boolean;
  busy: boolean;
  unseenAnswer: boolean;
}): { mode: LauncherMode; name: string; label: string; description: string } {
  const mode: LauncherMode = open
    ? "open"
    : busy
      ? "busy"
      : unseenAnswer
        ? "ready"
        : "idle";
  return {
    mode,
    name: LAUNCHER_NAME,
    label: LABELS[mode],
    description: DESCRIPTIONS[mode],
  };
}

/**
 * The launcher is born from the hero's CTA: hidden while that CTA is in view,
 * shown once it leaves (and from the start on pages without one). It stays
 * while the copilot is open or answering, and while it has keyboard focus,
 * so a focused control is never invisible.
 */
export function launcherVisible({
  sentinelInView,
  open,
  busy,
  focused,
}: {
  sentinelInView: boolean;
  open: boolean;
  busy: boolean;
  focused: boolean;
}): boolean {
  return !sentinelInView || open || busy || focused;
}

/**
 * Whether an answer is waiting that the visitor has not seen: one that
 * finished while the copilot was closed. Opening the copilot, or asking
 * again, clears it.
 */
export function nextUnseen(
  prev: boolean,
  { wasBusy, busy, open }: { wasBusy: boolean; busy: boolean; open: boolean },
): boolean {
  if (open || busy) return false;
  if (wasBusy) return true;
  return prev;
}

/** The page has rested this long: the label comes back. */
export const CHIP_REST_MS = 600;
/** Scrolling down faster than this tucks the label away. */
export const CHIP_FAST_PX_PER_S = 300;

/**
 * Extended-FAB behaviour for the label chip. `velocity` is px/s, positive
 * downwards; `idleMs` is the time since the last scroll. A slow scroll down
 * keeps whatever was showing, so the chip does not flicker.
 */
export function chipFromScroll(
  prevShown: boolean,
  { velocity, idleMs }: { velocity: number; idleMs: number },
): boolean {
  if (idleMs >= CHIP_REST_MS) return true;
  if (velocity < 0) return true;
  if (velocity > CHIP_FAST_PX_PER_S) return false;
  return prevShown;
}

/** How long the label shows on a phone when the launcher first appears. */
export const LAUNCHER_INTRO_MS = 3000;

/**
 * Whether the launcher's first-appearance label is still up: from the moment
 * it was first shown (`shownAt`, ms; null while it has not appeared) for
 * LAUNCHER_INTRO_MS.
 */
export function introActive(shownAt: number | null, now: number): boolean {
  return shownAt !== null && now - shownAt < LAUNCHER_INTRO_MS;
}

/**
 * Whether the label chip shows. Until the visitor has used the launcher once
 * it always does (an unlabelled hexagon reads as nothing). After that it
 * follows hover, focus and scrolling. While the copilot is open the window
 * says what this is, and the chip would sit over the page for nothing.
 *
 * On phones (`compact`, under 64rem) the capsule would cover headings while
 * the page scrolls under it, so only the hex stays: the label shows for its
 * first appearance (`intro`) and while it has keyboard focus (`focusVisible`). The accessible
 * name never changes, so voice control still finds "Ask my copilot".
 */
export function chipShown({
  used,
  mode,
  hovered,
  focused,
  scrollShown,
  compact = false,
  intro = false,
  focusVisible = focused,
}: {
  used: boolean;
  mode: LauncherMode;
  hovered: boolean;
  focused: boolean;
  scrollShown: boolean;
  compact?: boolean;
  intro?: boolean;
  /**
   * Focus a keyboard put there (:focus-visible). A closing dialog hands focus
   * back to its opener after a tap too, and that must not raise the label.
   */
  focusVisible?: boolean;
}): boolean {
  if (mode === "open") return false;
  if (compact) return intro || focusVisible;
  if (!used) return true;
  return hovered || focused || scrollShown;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The hand-off from the hero: as the hero leaves (exit progress k from 0.4
 * to 0.8), the glyph's lit cells brighten to full. The memory visibly passes
 * to the button. Dark cells stay dark.
 */
export function glyphLevels(base: ArrayLike<number>, heroExit: number): number[] {
  const h = Number.isFinite(heroExit) ? smoothstep(0.4, 0.8, heroExit) : 0;
  return Array.from(base, (value) => (value > 0 ? value + (1 - value) * h : 0));
}

export type Box = { x: number; y: number; width: number; height: number };

/**
 * The FLIP for the glyph's hand-off: the translate and scale that put the
 * launcher's glyph (`to`, its resting box) exactly over the CTA's glyph
 * (`from`). Null when there is nothing sensible to fly from: a box with no
 * size, or a CTA more than a viewport away (the visitor jumped there), where
 * a crossfade reads better than a streak across the screen.
 */
export function flipFrom(
  from: Box,
  to: Box,
  viewportH: number,
): { dx: number; dy: number; scale: number } | null {
  if (from.width <= 0 || from.height <= 0 || to.width <= 0 || to.height <= 0) {
    return null;
  }
  if (from.y + from.height < -viewportH || from.y > 2 * viewportH) return null;
  return {
    dx: from.x + from.width / 2 - (to.x + to.width / 2),
    dy: from.y + from.height / 2 - (to.y + to.height / 2),
    scale: from.width / to.width,
  };
}
