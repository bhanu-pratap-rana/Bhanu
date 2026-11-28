// Where the 3D core sits in the hero. Pure geometry in viewport pixels, so it
// is testable without a DOM: the caller measures the hero stage, the copy
// column and the launcher, and hands the result to the renderer as
// { cx, cy, r } (r = the px that the core's 5.6 world-unit radius maps to).
//
// The laptop hero is a deliberate overlap: the Latin name may overhang the
// copy column by up to 18% and sits in front of the canvas, but the cluster
// itself keeps clear of the copy column (copyRight is the column's edge, not
// the overhanging name's).
//
// Below the placement: the staging (resolveCoreStage), which turns the hero
// placement and its exit progress, or the copilot window's dock, into the
// presence values the renderer draws from; the flights between them; and
// the renderer's pixel budget and scissor maths. Nothing here imports the
// renderer or its physics: MemoryCore loads this eagerly.

export type Rect = { left: number; top: number; width: number; height: number };
export type CorePlacement = { cx: number; cy: number; r: number };
export type Ellipse = { cx: number; cy: number; rx: number; ry: number };

/**
 * How far the drawn prisms reach from (cx, cy), in units of r, at the hero
 * camera (elevation 0.62 with pointer lean, prisms up to full glow height).
 * The partial outer ring makes the cluster reach further left than right.
 * Checked against three's camera in core-stage.test.ts.
 */
export const CLUSTER_EXTENT = { left: 1.2, right: 0.9, up: 0.9, down: 1.01 } as const;

/**
 * The visible floor ring as a screen ellipse, in units of r: centred dy·r
 * below the core's centre. Checked against three's camera in the tests.
 */
export const FLOOR_ELLIPSE = { rx: 1.08, ry: 0.79, dy: 0.27 } as const;

/** Clear space between the copy column and the cluster's left edge. */
export const COPY_GAP_PX = 16;
/** The core never grows past this, however large the screen. */
export const MAX_HERO_R = 420;
/** The launcher's keep-out margin. */
export const KEEP_OUT_MARGIN_PX = 24;

// ---------------------------------------------------------------------------
// Laptop hero layout. hero.css uses the same numbers; change both together.

/** Container width (the .page content box) at which the hero splits in two. */
export const HERO_SPLIT_MIN_PX = 896; // 56rem
/** The header above the hero (hero min-height is 100svh minus this). */
export const HEADER_PX = 76; // 4.75rem
/** The page's own side padding on laptops. */
export const PAGE_GUTTER_PX = 16;
/**
 * Width of "Bhanu Pratap Rana" in em at the lockup's cut: Eczar 630 with
 * -0.01em tracking. Measured from the font files: the shaped advance is
 * 9.010em at 600 and 9.318em at 700 (linear in weight), so 9.102em at 630,
 * less 17 x 0.01em of tracking = 8.932em. Rounded up, the safe side for both
 * the overhang rule and the phone fit.
 */
export const LATIN_NAME_EM = 8.94;
/** How far the Latin name may overhang the copy column, as a share of its width. */
export const LOCKUP_MAX_OVERHANG = 0.18;

const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v));

/** The site frame's max width (84rem): header, hero copy and sections share its left edge. */
export const FRAME_MAX_PX = 1344;

/**
 * Copy column's left inset from the page gutter, equal to the frame's left
 * edge (globals.css `--frame-inset`):
 * `max(0px, (100cqi - 84rem) / 2) + clamp(1.5rem, 5cqi, 5rem)`.
 */
export function heroInset(containerPx: number): number {
  return Math.max(0, (containerPx - FRAME_MAX_PX) / 2) + clamp(24, 0.05 * containerPx, 80);
}

/** Copy column width: `clamp(26rem, 38cqi, 34rem)`. */
export function heroCopyWidth(containerPx: number): number {
  return clamp(416, 0.38 * containerPx, 544);
}

/** Lockup font size on laptops: `clamp(52px, 4.8cqi, 68px)`. */
export function heroLockupPx(containerPx: number): number {
  return clamp(52, 0.048 * containerPx, 68);
}

// Stacked hero (container < 56rem): the portrait badge and the name share a
// row, and the name never wraps.

/** Gap between the badge and the name on the stacked hero (hero.css column-gap). */
export const HERO_PHONE_GAP_PX = 12;

/** Lockup font size on the stacked hero: `min(64px, 7.8cqi)`. */
export function heroPhoneLockupPx(containerPx: number): number {
  return Math.min(64, 0.078 * containerPx);
}

/** Portrait badge width on the stacked hero: `clamp(72px, 24cqi, 104px)`. */
export function heroPhoneBadgePx(containerPx: number): number {
  return clamp(72, 0.24 * containerPx, 104);
}

// ---------------------------------------------------------------------------

export type HeroPlacementInput = {
  /** The hero stage box (`[data-core-stage]`) in viewport px. */
  stage: Rect;
  /**
   * Right edge the core may use: the canvas's right edge (the core bleeds past
   * the page gutter to the viewport edge). Defaults to the stage's right edge.
   */
  viewRight?: number;
  /** Right edge of the copy column (not the overhanging name); null on the stacked phone layout. */
  copyRight: number | null;
  /** A box the floor ring must never reach: the launcher plus 24px (see keepOutAround). */
  keepOut?: Rect | null;
};

/**
 * Laptop (copy column beside the stage): the core takes the open space right
 * of the copy. cx = copyRight + 0.52·available, cy = top + 0.55·h,
 * r = min(0.52·available, 0.42·h, 420), then shrunk so the cluster's left edge
 * stays copyRight + 16px clear and the floor ring stays out of keepOut.
 * Phone (stacked band): centred in the band, r = 0.56·min(w, h).
 * r is 0 when there is no room; the caller then skips drawing.
 */
export function heroCorePlacement({
  stage,
  copyRight,
  viewRight,
  keepOut,
}: HeroPlacementInput): CorePlacement {
  const { left, top, width, height } = stage;
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return { cx: 0, cy: 0, r: 0 };
  }

  let cx: number;
  let cy: number;
  let r: number;
  if (copyRight === null || !Number.isFinite(copyRight)) {
    cx = left + width / 2;
    cy = top + height / 2;
    r = 0.56 * Math.min(width, height);
  } else {
    const right = viewRight !== undefined && Number.isFinite(viewRight) ? viewRight : left + width;
    const available = right - copyRight;
    cx = copyRight + 0.52 * available;
    cy = top + 0.55 * height;
    const roomLeft = (cx - copyRight - COPY_GAP_PX) / CLUSTER_EXTENT.left;
    r = Math.max(0, Math.min(0.52 * available, 0.42 * height, MAX_HERO_R, roomLeft));
  }

  if (keepOut && r > 0) r = clampToKeepOut({ cx, cy, r }, keepOut);
  return { cx, cy, r };
}

/** The floor ring's screen ellipse for a placement. */
export function floorEllipse({ cx, cy, r }: CorePlacement): Ellipse {
  return {
    cx,
    cy: cy + FLOOR_ELLIPSE.dy * r,
    rx: FLOOR_ELLIPSE.rx * r,
    ry: FLOOR_ELLIPSE.ry * r,
  };
}

/** True when the ellipse's interior overlaps the rect (touching edges do not count). */
export function ellipseIntersectsRect(e: Ellipse, rect: Rect): boolean {
  // Scaling x by 1/rx and y by 1/ry turns the ellipse into a unit circle and
  // keeps the rect axis-aligned, so the per-axis clamp is the exact nearest point.
  const px = clamp(rect.left, e.cx, rect.left + rect.width);
  const py = clamp(rect.top, e.cy, rect.top + rect.height);
  if (e.rx <= 0 || e.ry <= 0) {
    return px === e.cx && py === e.cy && rect.width > 0 && rect.height > 0;
  }
  return ((px - e.cx) / e.rx) ** 2 + ((py - e.cy) / e.ry) ** 2 < 1;
}

/** The launcher's box grown by the keep-out margin on every side. */
export function keepOutAround(box: Rect, margin = KEEP_OUT_MARGIN_PX): Rect {
  return {
    left: box.left - margin,
    top: box.top - margin,
    width: box.width + 2 * margin,
    height: box.height + 2 * margin,
  };
}

/**
 * The largest r (no larger than the given one) whose floor ring stays out of
 * keepOut. The ring contains (cx, cy) and scales about it with r, so overlap
 * only grows with r and a bisection finds the edge.
 */
function clampToKeepOut(p: CorePlacement, keepOut: Rect): number {
  const hits = (r: number) => ellipseIntersectsRect(floorEllipse({ ...p, r }), keepOut);
  if (!hits(p.r)) return p.r;
  const inside =
    p.cx > keepOut.left &&
    p.cx < keepOut.left + keepOut.width &&
    p.cy > keepOut.top &&
    p.cy < keepOut.top + keepOut.height;
  if (inside) return 0;
  let lo = 0;
  let hi = p.r;
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2;
    if (hits(mid)) hi = mid;
    else lo = mid;
  }
  return lo;
}

// ---------------------------------------------------------------------------
// Staging (K4): where the core is drawn and how present it is. The renderer
// reads only these values; nothing in it knows about scroll progress.

/** hero, dock and none are where it rests; flight is the way between (open, close). */
export type CoreKind = "hero" | "dock" | "flight" | "none";

/**
 * Everything the renderer needs to place and show the core. All factors are
 * 0..1 multipliers of the core's full look.
 */
export type CorePresence = {
  kind: CoreKind;
  /** Centre and radius in viewport px (r = the px the 5.6-unit core radius maps to). */
  cx: number;
  cy: number;
  r: number;
  /** Camera elevation, radians. */
  el: number;
  /** The whole core's fade: one uniform, never a layer style. */
  opacity: number;
  /** Unlit prisms: 1 as designed, lower darker. Lit notes stay lit. */
  dim: number;
  /** Warm light of the notes the copilot touched. */
  glow: number;
  /** Exit shape, 0 (standing) to 1 (settled to EXIT_HEIGHT, inner ring first). */
  settle: number;
  /** The question orb, the threads from it, the drifting dust. */
  orb: number;
  threads: number;
  dust: number;
  /** Time-based motion: drift, breathing, dust, the pointer's lift. */
  ambient: boolean;
  /**
   * Viewport box to draw inside (the dock's visible part; zero-sized when
   * none of it shows); null: the renderer clips to the cluster only.
   */
  clip: Rect | null;
};

/** Camera elevation in the hero (the extents above are measured at it). */
export const HERO_EL = 0.62;
/** A little more side-on in the copilot's dock. */
export const DOCK_EL = 0.5;

// ---------------------------------------------------------------------------
// The core's shape, shared with core-renderer so the framing below can be
// checked against what it draws.

/** The skyline: a prism's resting height, taller towards the centre, varied by a fixed seed. */
export function baseHeight(index: number, ring: number): number {
  const seed = (index * 0.7548776) % 1;
  return 0.55 + 0.9 * seed + 0.38 * (3 - Math.min(3, ring));
}

/**
 * The most a prism rises above its skyline: the renderer's warm glow (2.3),
 * section (0.45), hover (0.5) and breathing (0.05) terms, plus 0.3 for a
 * ripple or the press springing back.
 */
export const MAX_RISE = 3.6;
/** The question orb's height above the floor, and its radius at the top of its pulse. */
export const ORB_HEIGHT = 6.4;
export const ORB_MAX_RADIUS = 0.2 * 1.12;

/**
 * How far the drawn core reaches from (cx, cy) in the dock, in units of r:
 * at DOCK_EL with the pointer's lean, from every azimuth (the camera drifts
 * all the way round), prisms at their tallest and the orb. Checked against
 * three's camera in core-stage.test.ts.
 */
export const DOCK_EXTENT = { side: 1.12, up: 1.1, down: 0.85 } as const;
/** Clear space kept inside the dock on every side. */
export const DOCK_INSET_PX = 8;

/**
 * The core in the copilot's dock: as large as fits inside the dock less the
 * inset, centred across it, and placed so its reach above and below the
 * centre (the orb and back prisms above, the front row below) is centred
 * down it. r is 0 when the dock has no room.
 */
export function dockPlacement(dock: Rect): CorePlacement {
  const { left, top, width, height } = dock;
  if (!finite(left, top, width, height)) return { cx: 0, cy: 0, r: 0 };
  const w = width - 2 * DOCK_INSET_PX;
  const h = height - 2 * DOCK_INSET_PX;
  const span = DOCK_EXTENT.up + DOCK_EXTENT.down;
  const r = Math.max(0, Math.min(w / (2 * DOCK_EXTENT.side), h / span));
  return {
    cx: left + width / 2,
    cy: top + DOCK_INSET_PX + DOCK_EXTENT.up * r + Math.max(0, h - span * r) / 2,
    r,
  };
}
/** Exit progress over which the prisms settle (before the fade). */
export const EXIT_SETTLE = [0.1, 0.6] as const;
/** Exit progress over which the core fades out. */
export const EXIT_FADE = [0.6, 1] as const;
/** Height the prisms settle to, as a share of their own. Never below the floor. */
export const EXIT_HEIGHT = 0.35;
/** Warm light left once settled. */
export const EXIT_GLOW = 0.4;
/** How much later each ring starts settling than the one inside it, as a share of the exit. */
export const EXIT_RING_STAGGER = 0.25;
/** With motion off, the hero steps from in place to gone here. */
export const STILL_STEP = 0.5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const finite = (...values: number[]) => values.every(Number.isFinite);

/** A presence that draws nothing. A fresh object: the renderer's copy is written in place. */
export function nonePresence(): CorePresence {
  return {
    kind: "none",
    cx: 0,
    cy: 0,
    r: 0,
    el: HERO_EL,
    opacity: 0,
    dim: 1,
    glow: 1,
    settle: 0,
    orb: 0,
    threads: 0,
    dust: 0,
    ambient: false,
    clip: null,
  };
}

/**
 * Scroll distance over which the hero leaves: from in place until the
 * cluster's lowest prisms pass the top of the view (rest = the placement
 * with the page scrolled to the top).
 */
export function heroTravel(rest: CorePlacement): number {
  return rest.cy + CLUSTER_EXTENT.down * rest.r;
}

/**
 * How far the hero has left the view: 0 in place, 1 gone. `travel` null
 * means the page has no hero at all, which reads as gone.
 */
export function heroExitProgress(scrolled: number, travel: number | null): number {
  if (travel === null) return 1;
  const y = Number.isFinite(scrolled) ? Math.max(0, scrolled) : 0;
  if (!(travel > 0)) return y > 0 ? 1 : 0;
  return clamp01(y / travel);
}

/**
 * Height factor for a prism on `ring` as the hero leaves (settle 0..1): the
 * inner ring settles first, each ring eases from 1 to EXIT_HEIGHT and never
 * rises again.
 */
export function exitHeight(settle: number, ring: number, maxRing: number): number {
  if (!Number.isFinite(settle) || settle <= 0) return 1;
  const rings = Math.max(0, maxRing);
  const span = 1 + EXIT_RING_STAGGER * rings;
  const local = clamp01(Math.min(1, settle) * span - EXIT_RING_STAGGER * Math.min(Math.max(0, ring), rings));
  return 1 - (1 - EXIT_HEIGHT) * smooth(local);
}

export type StageInput = {
  /** The hero placement at the current scroll (it follows the hero rect), or null without one. */
  hero: CorePlacement | null;
  /** Hero exit progress k (heroExitProgress). */
  exit: number;
  /** Reduced motion or paused: no glides, the hero steps at k = 0.5. */
  still: boolean;
  /** The laptop copilot window is open. */
  open?: boolean;
  /** Its dock box in viewport px, as laid out (not as the open animation scales it). */
  dock?: Rect | null;
  /** The part of the dock on screen (dockClip); defaults to the dock. */
  clip?: Rect | null;
  /** The launcher's box: with one, "none" rests on its hex, the door the core goes through. */
  launcher?: Rect | null;
};

/**
 * Where the core is and how present it is.
 * - Open window with a dock that has room: the dock, fully lit, dust off,
 *   clipped to the dock's visible part, wherever the hero is.
 * - Hero: exactly on the hero placement (no lag while scrolling). Over k
 *   0.1 to 0.6 the prisms settle and the glow dims to 0.4, then the core
 *   fades over 0.6 to 1. Still: one step at k = 0.5.
 * - Otherwise nothing is drawn; with a launcher box the empty presence sits
 *   on its hex, so a flight to or from "none" shrinks into or grows out of it.
 */
export function resolveCoreStage({
  hero,
  exit,
  still,
  open,
  dock,
  clip,
  launcher,
}: StageInput): CorePresence {
  const docked = open && dock ? dockPlacement(dock) : null;
  if (dock && docked && docked.r > 0) {
    return {
      kind: "dock",
      cx: docked.cx,
      cy: docked.cy,
      r: docked.r,
      el: DOCK_EL,
      opacity: 1,
      dim: 1,
      glow: 1,
      settle: 0,
      orb: 1,
      threads: 1,
      dust: 0,
      ambient: !still,
      clip: { ...(clip ?? dock) },
    };
  }

  const none = () => (launcher ? launcherPresence(launcher) : nonePresence());
  if (!hero || !finite(hero.cx, hero.cy, hero.r) || hero.r <= 0) return none();
  const raw = Number.isFinite(exit) ? clamp01(exit) : 0;
  const k = still ? (raw < STILL_STEP ? 0 : 1) : raw;
  const opacity = 1 - clamp01((k - EXIT_FADE[0]) / (EXIT_FADE[1] - EXIT_FADE[0]));
  if (opacity <= 0) return none();
  const settle = clamp01((k - EXIT_SETTLE[0]) / (EXIT_SETTLE[1] - EXIT_SETTLE[0]));
  return {
    kind: "hero",
    cx: hero.cx,
    cy: hero.cy,
    r: hero.r,
    el: HERO_EL,
    opacity,
    dim: 1 - 0.35 * settle,
    glow: 1 - (1 - EXIT_GLOW) * smooth(settle),
    settle,
    orb: 1 - settle,
    threads: 1 - settle,
    dust: 1,
    ambient: !still,
    clip: null,
  };
}

/** Where the launcher rests (fixed, bottom right), for the hero's keep-out. */
export function launcherRestBox(viewW: number, viewH: number, size: number, gap: number): Rect {
  const s = Number.isFinite(size) && size > 0 ? size : 72;
  const g = Number.isFinite(gap) && gap >= 0 ? gap : 24;
  return { left: viewW - g - s, top: viewH - g - s, width: s, height: s };
}

/** How far the capsule's square right end tucks under the hex (copilot-window.css --launcher-tuck). */
const LAUNCHER_TUCK = 0.3;
/** The idle capsule ("Ask my copilot") less its tuck, for when it cannot be measured. */
const LAUNCHER_CHIP_ESTIMATE_PX = 148;

/**
 * The launcher as seen: its hex plus the label capsule growing out of the
 * hex's left side, for the hero's keep-out (the capsule shows until first
 * use, and with keyboard focus while the hero is still in view). The capsule
 * is no taller than the hex, so only the left edge moves. `chipWidth` is the
 * capsule's measured width; not finite or not positive (not mounted yet), an
 * estimate of the idle label's is used.
 */
export function launcherFootprint(hex: Rect, chipWidth: number): Rect {
  const tuck = LAUNCHER_TUCK * hex.width;
  const width =
    Number.isFinite(chipWidth) && chipWidth > 0 ? chipWidth : LAUNCHER_CHIP_ESTIMATE_PX + tuck;
  const left = Math.min(hex.left, hex.left + tuck - width);
  return { left, top: hex.top, width: hex.left + hex.width - left, height: hex.height };
}

/** The core's radius when it has shrunk into the launcher's hex. */
export const LAUNCHER_R = 24;

/** "None", resting on the launcher's hex: small, invisible, drawing nothing. */
export function launcherPresence(box: Rect): CorePresence {
  return {
    ...nonePresence(),
    cx: box.left + box.width / 2,
    cy: box.top + box.height / 2,
    r: LAUNCHER_R,
    el: DOCK_EL,
    glow: 1,
    orb: 1,
    threads: 1,
  };
}

/** The core is in the copilot's dock (flights start when this changes). */
export function isDocked(presence: CorePresence): boolean {
  return presence.kind === "dock";
}

// ---------------------------------------------------------------------------
// The dock's rects. The window floats over the page and animates (scale
// about its bottom-right corner while opening and closing, a slide while
// tucked), so the dock is read from the page every frame and two rects come
// out of it: where the core goes (the dock as laid out, so a flight started
// mid-animation lands where the window ends up) and what may be drawn (the
// part of the dock on screen now).

/**
 * The window's box as laid out, from its box as drawn and its untransformed
 * size: the open/close animation scales it about its bottom-right corner,
 * which therefore stays put.
 */
export function windowLayoutBox(drawn: Rect, layoutWidth: number, layoutHeight: number): Rect {
  return {
    left: drawn.left + drawn.width - layoutWidth,
    top: drawn.top + drawn.height - layoutHeight,
    width: layoutWidth,
    height: layoutHeight,
  };
}

/** `rect`, drawn inside `from`, carried to the same place inside `to` (scale and offset per axis). */
export function mapRect(rect: Rect, from: Rect, to: Rect): Rect {
  if (!(from.width > 0) || !(from.height > 0)) return { ...rect };
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  return {
    left: to.left + (rect.left - from.left) * sx,
    top: to.top + (rect.top - from.top) * sy,
    width: rect.width * sx,
    height: rect.height * sy,
  };
}

/** Least width left of the copilot window for the hero's 2D stand-in to show at all (px). */
export const FALLBACK_MIN_ROOM_PX = 256;
/** Clear space between the stand-in and the window's left edge (px). */
export const FALLBACK_WINDOW_GAP_PX = 32;

/** show: draw it at all; cut: px its right edge is pulled in by (HeroStageFallback). */
export type FallbackFit = { show: boolean; cut: number };

/**
 * Where the hero's 2D stand-in (HeroStageFallback) may draw while the laptop
 * copilot window floats over the stage: its whole box when the window is
 * closed, tucked or clear of it; else only the part left of the window
 * (minus a gap), and not at all when that part is narrower than
 * FALLBACK_MIN_ROOM_PX, so it never shows as a sliver half behind the
 * window. `box` is the stand-in's laid-out box and `windowLeft` the window's
 * laid-out left edge (null: no window over the stage), both viewport px.
 */
export function heroFallbackFit(
  box: { left: number; right: number },
  windowLeft: number | null,
): FallbackFit {
  if (windowLeft === null || !Number.isFinite(windowLeft)) return { show: true, cut: 0 };
  const edge = windowLeft - FALLBACK_WINDOW_GAP_PX;
  if (edge >= box.right) return { show: true, cut: 0 };
  if (edge - box.left < FALLBACK_MIN_ROOM_PX) return { show: false, cut: 0 };
  return { show: true, cut: box.right - edge };
}

/** The tucked window shows only its title strip. */
export const TUCKED_STRIP_PX = 56;

/** The part of the window on screen: all of it, or only its title strip while tucked. */
export function windowVisibleRect(win: Rect, tucked: boolean): Rect {
  return tucked ? { ...win, height: Math.min(TUCKED_STRIP_PX, win.height) } : { ...win };
}

/**
 * The overlap of two rects; zero-sized (at the later edges) when they do not
 * meet. The dock's visible part is the window's visible part cut to the
 * panel header's scrollport, which shrinks on short screens.
 */
export function intersectRect(a: Rect, b: Rect): Rect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * Where the core may draw: the dock inside the window's visible part, inset
 * by `inset` px (off the window's border and any sub-pixel seam). Zero-sized
 * when none of the dock shows.
 */
export function dockClip(dock: Rect, visible: Rect, inset = 1): Rect {
  const left = Math.max(dock.left, visible.left) + inset;
  const top = Math.max(dock.top, visible.top) + inset;
  const right = Math.min(dock.left + dock.width, visible.left + visible.width) - inset;
  const bottom = Math.min(dock.top + dock.height, visible.top + visible.height) - inset;
  if (!(right > left) || !(bottom > top)) return { left, top, width: 0, height: 0 };
  return { left, top, width: right - left, height: bottom - top };
}

// ---------------------------------------------------------------------------
// Flights. Only opening and closing the window move the core between the
// hero, the dock and the launcher; everything else (scroll, resize, font
// load, the window tucking) follows exactly. A flight springs cx, cy, r and
// el, critically damped (no overshoot, ~450ms), toward the target as it is
// each frame, and blends the rest of the presence on the same spring.

/** Critically damped: from rest, 97% of the way in 450ms, never past it. */
export const FLIGHT_OMEGA = 12;
/** A flight lands by this time whatever happens (a stalled tab, a target that keeps moving). */
export const FLIGHT_MAX_S = 1.5;
const LAND_PX = 0.5;
const LAND_PX_PER_S = 5;
const LAND_EL = 0.002;
const LAND_EL_PER_S = 0.02;
const LAND_MIX = 0.002;

type Channel = "cx" | "cy" | "r" | "el";
const CHANNELS: readonly Channel[] = ["cx", "cy", "r", "el"];
type Factor = "opacity" | "dim" | "glow" | "settle" | "orb" | "threads" | "dust";
const FACTORS: readonly Factor[] = ["opacity", "dim", "glow", "settle", "orb", "threads", "dust"];

export type Flight = {
  active: boolean;
  elapsed: number;
  /** Where the core is on the way, and how fast each channel moves (per second). */
  at: Record<Channel, number>;
  vel: Record<Channel, number>;
  /** 0 = the presence the flight left with, 1 = the target's. */
  mix: number;
  vmix: number;
  from: Record<Factor, number>;
};

export function createFlight(): Flight {
  const zero = () => ({ cx: 0, cy: 0, r: 0, el: 0 });
  return {
    active: false,
    elapsed: 0,
    at: zero(),
    vel: zero(),
    mix: 1,
    vmix: 0,
    from: { opacity: 0, dim: 1, glow: 1, settle: 0, orb: 0, threads: 0, dust: 0 },
  };
}

/** Something of the core is drawn (a flight leaves from it; otherwise from the launcher). */
function drawable(p: CorePresence): boolean {
  return p.kind !== "none" && p.r > 0 && p.opacity > 0.002;
}

/** Where a flight leaves from: the core as drawn, or the launcher's hex when nothing is. */
export function flightFrom(shown: CorePresence, launcher: Rect): CorePresence {
  return drawable(shown) ? shown : launcherPresence(launcher);
}

/**
 * Start (or turn round) a flight from `from`. A flight already under way
 * keeps its speed, so turning back mid-air has no jump; one from rest starts
 * still.
 */
export function startFlight(f: Flight, from: CorePresence): void {
  for (const c of CHANNELS) {
    f.at[c] = from[c];
    if (!f.active) f.vel[c] = 0;
  }
  for (const k of FACTORS) f.from[k] = from[k];
  f.mix = 0;
  f.vmix = 0;
  f.elapsed = 0;
  f.active = true;
}

/** One exact step of a critically damped spring toward 0: [x, v] after dt. */
function damp(x: number, v: number, dt: number): [number, number] {
  const e = Math.exp(-FLIGHT_OMEGA * dt);
  const c = v + FLIGHT_OMEGA * x;
  return [(x + c * dt) * e, (v - FLIGHT_OMEGA * c * dt) * e];
}

function copyPresence(out: CorePresence, p: CorePresence) {
  Object.assign(out, p);
  out.clip = p.clip ? { ...p.clip } : null;
}

/**
 * Advance the flight by dt toward `target` (read afresh each frame, so a
 * window still opening or a page still scrolling is followed) and write
 * what to draw into `out`. Returns true while it is still in the air; on
 * landing `out` is exactly the target. An idle flight just shows the target.
 * `wallDt` is the real time since the last step (the renderer clamps `dt`
 * on slow frames): FLIGHT_MAX_S counts it, so a slow device still lands on
 * time. It defaults to `dt`.
 */
export function stepFlight(
  f: Flight,
  target: CorePresence,
  dt: number,
  out: CorePresence,
  wallDt: number = dt,
): boolean {
  if (!f.active) {
    copyPresence(out, target);
    return false;
  }
  const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
  f.elapsed += Number.isFinite(wallDt) && wallDt > step ? wallDt : step;
  let landed = f.elapsed >= FLIGHT_MAX_S;
  if (step > 0) {
    let near = true;
    for (const c of CHANNELS) {
      const [x, v] = damp(f.at[c] - target[c], f.vel[c], step);
      f.at[c] = target[c] + x;
      f.vel[c] = v;
      const el = c === "el";
      if (Math.abs(x) > (el ? LAND_EL : LAND_PX) || Math.abs(v) > (el ? LAND_EL_PER_S : LAND_PX_PER_S)) {
        near = false;
      }
    }
    const [m, vm] = damp(f.mix - 1, f.vmix, step);
    f.mix = 1 + m;
    f.vmix = vm;
    if (Math.abs(m) > LAND_MIX) near = false;
    landed ||= near;
  }
  if (landed) {
    f.active = false;
    copyPresence(out, target);
    return false;
  }
  const mix = clamp01(f.mix);
  out.kind = "flight";
  out.cx = f.at.cx;
  out.cy = f.at.cy;
  out.r = Math.max(0, f.at.r);
  out.el = f.at.el;
  for (const k of FACTORS) out[k] = f.from[k] + (target[k] - f.from[k]) * mix;
  out.ambient = target.ambient;
  // In the air it draws unclipped, over the page and the window alike.
  out.clip = null;
  return true;
}

// ---------------------------------------------------------------------------
// Fidelity: the renderer draws only inside the cluster's screen rect
// (scissor), so the pixel budget is spent there rather than on the viewport.

/** Device pixels the core may fill inside its rect. */
export const PIXEL_BUDGET = { fine: 3e6, coarse: 1.2e6 } as const;
/** Device pixels the whole (full-viewport) drawing buffer may hold. */
export const BUFFER_BUDGET = { fine: 8.3e6, coarse: 2.5e6 } as const;
export const DPR_CAP = { fine: 2, coarse: 1.5 } as const;

export function corePixelRatio({
  dpr,
  coarse,
  rectArea,
  canvasArea,
}: {
  dpr: number;
  coarse: boolean;
  /** CSS px² of the rect drawn into (see scissorBox: area). */
  rectArea: number;
  /** CSS px² of the canvas. */
  canvasArea: number;
}): number {
  const kind = coarse ? "coarse" : "fine";
  let ratio = Math.min(Number.isFinite(dpr) && dpr > 0 ? dpr : 1, DPR_CAP[kind]);
  if (rectArea > 0) ratio = Math.min(ratio, Math.sqrt(PIXEL_BUDGET[kind] / rectArea));
  if (canvasArea > 0) ratio = Math.min(ratio, Math.sqrt(BUFFER_BUDGET[kind] / canvasArea));
  return Math.max(0.5, ratio);
}

export type ScissorOut = { x: number; y: number; width: number; height: number; area: number };

/**
 * The scissor for projected bounds (x0..x1, y0..y1 in viewport px, y down):
 * padded by `margin`, intersected with `clip` and the canvas, with y flipped
 * to WebGL's bottom-left origin. Writes into `out` (no allocation per frame)
 * and returns false when nothing of it is on the canvas.
 * `area` is the padded rect clipped across the canvas but not down it, so
 * scrolling (which only moves it up) never changes the pixel budget.
 */
export function scissorBox(
  out: ScissorOut,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  canvasW: number,
  canvasH: number,
  clip: Rect | null,
  margin: number,
): boolean {
  if (!finite(x0, y0, x1, y1, canvasW, canvasH)) return false;
  let left = x0 - margin;
  let top = y0 - margin;
  let right = x1 + margin;
  let bottom = y1 + margin;
  out.area = Math.max(0, Math.min(right, canvasW) - Math.max(left, 0)) * Math.max(0, bottom - top);
  if (clip) {
    left = Math.max(left, clip.left);
    top = Math.max(top, clip.top);
    right = Math.min(right, clip.left + clip.width);
    bottom = Math.min(bottom, clip.top + clip.height);
  }
  left = Math.max(0, Math.floor(left));
  top = Math.max(0, Math.floor(top));
  right = Math.min(canvasW, Math.ceil(right));
  bottom = Math.min(canvasH, Math.ceil(bottom));
  if (right <= left || bottom <= top) return false;
  out.x = left;
  out.y = canvasH - bottom;
  out.width = right - left;
  out.height = bottom - top;
  return true;
}

// ---------------------------------------------------------------------------
// Events the core shows.

/**
 * Ripple amplitude for an arriving answer: core-physics' ANSWER_RIPPLE_AMP,
 * repeated here so the eager bundle does not pull in the physics (the test
 * keeps the two equal).
 */
export const ANSWER_AMP = 0.2;

/**
 * An answer arriving ripples out from each note it cites. Many cited notes
 * share the amplitude (1/√n each), so neighbouring waves add up calmly.
 */
export function answerRipples(
  citedIds: readonly string[],
  ids: readonly string[],
): { index: number; amp: number }[] {
  const indices: number[] = [];
  for (const id of citedIds) {
    const index = ids.indexOf(id);
    if (index >= 0 && !indices.includes(index)) indices.push(index);
  }
  const amp = ANSWER_AMP / Math.sqrt(Math.max(1, indices.length));
  return indices.map((index) => ({ index, amp }));
}
