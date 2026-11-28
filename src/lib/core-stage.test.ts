import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { ANSWER_RIPPLE_AMP } from "./core-physics";
import { axialToWorld, hexSpiral } from "./honeycomb";
import {
  ANSWER_AMP,
  CLUSTER_EXTENT,
  COPY_GAP_PX,
  type CorePlacement,
  type CorePresence,
  DOCK_EL,
  DOCK_INSET_PX,
  EXIT_GLOW,
  EXIT_HEIGHT,
  FALLBACK_MIN_ROOM_PX,
  FALLBACK_WINDOW_GAP_PX,
  FLIGHT_MAX_S,
  FLOOR_ELLIPSE,
  HEADER_PX,
  HERO_EL,
  HERO_PHONE_GAP_PX,
  LATIN_NAME_EM,
  LAUNCHER_R,
  LOCKUP_MAX_OVERHANG,
  MAX_RISE,
  ORB_HEIGHT,
  ORB_MAX_RADIUS,
  PAGE_GUTTER_PX,
  type Rect,
  answerRipples,
  baseHeight,
  corePixelRatio,
  createFlight,
  dockClip,
  intersectRect,
  dockPlacement,
  ellipseIntersectsRect,
  exitHeight,
  flightFrom,
  floorEllipse,
  heroCopyWidth,
  heroCorePlacement,
  heroExitProgress,
  heroFallbackFit,
  heroInset,
  heroLockupPx,
  heroPhoneBadgePx,
  heroPhoneLockupPx,
  heroTravel,
  isDocked,
  keepOutAround,
  launcherPresence,
  launcherFootprint,
  launcherRestBox,
  mapRect,
  nonePresence,
  resolveCoreStage,
  scissorBox,
  startFlight,
  stepFlight,
  windowLayoutBox,
  windowVisibleRect,
} from "./core-stage";

// The hero as hero.css lays it out at a laptop viewport: the stage is the
// whole hero box (inside the page gutters, below the header), the core may
// use the canvas up to the viewport's right edge, and the copy column starts
// one inset in from the page gutter.
function laptopHero(vw: number, vh: number) {
  const container = vw - 2 * PAGE_GUTTER_PX;
  const copyLeft = PAGE_GUTTER_PX + heroInset(container);
  const copyWidth = heroCopyWidth(container);
  const stage: Rect = {
    left: PAGE_GUTTER_PX,
    top: HEADER_PX,
    width: container,
    height: vh - HEADER_PX,
  };
  return { container, copyLeft, copyWidth, copyRight: copyLeft + copyWidth, stage, viewRight: vw };
}

// The launcher: a 72px box 24px in from the bottom-right corner.
function launcherBox(vw: number, vh: number): Rect {
  return { left: vw - 24 - 72, top: vh - 24 - 72, width: 72, height: 72 };
}

function clusterLeft(p: CorePlacement): number {
  return p.cx - CLUSTER_EXTENT.left * p.r;
}

describe("heroCorePlacement: laptop radii", () => {
  it.each([
    [1440, 900, 328], // the copy column starts at the frame's edge (x = 118)
    [1366, 768, 290],
    [1280, 720, 270],
  ])("%ix%i gives r ≈ %i", (vw, vh, expected) => {
    const { stage, copyRight, viewRight } = laptopHero(vw, vh);
    const p = heroCorePlacement({ stage, copyRight, viewRight });
    expect(Math.abs(p.r - expected)).toBeLessThanOrEqual(12);
    // Centre sits in the open space right of the copy, 55% down the hero.
    expect(p.cx).toBeGreaterThan(copyRight);
    expect(p.cy).toBeCloseTo(stage.top + 0.55 * stage.height, 5);
  });

  it("uses the stage's right edge when no viewRight is given", () => {
    const stage: Rect = { left: 0, top: 76, width: 1440, height: 824 };
    const a = heroCorePlacement({ stage, copyRight: 614 });
    const b = heroCorePlacement({ stage, copyRight: 614, viewRight: 1440 });
    expect(a).toEqual(b);
  });

  it("never grows past 420px, however big the screen", () => {
    const { stage, copyRight, viewRight } = laptopHero(3840, 2160);
    expect(heroCorePlacement({ stage, copyRight, viewRight }).r).toBe(420);
  });
});

describe("heroCorePlacement: the cluster never reaches the copy", () => {
  it.each([
    [960, 900],
    [1024, 768],
    [1280, 720],
    [1280, 800],
    [1366, 768],
    [1440, 900],
    [1536, 864],
    [1920, 1080],
  ])("%ix%i: cluster left edge >= copyRight + 16", (vw, vh) => {
    const { stage, copyRight, viewRight } = laptopHero(vw, vh);
    const p = heroCorePlacement({ stage, copyRight, viewRight });
    expect(clusterLeft(p)).toBeGreaterThanOrEqual(copyRight + COPY_GAP_PX - 1e-6);
  });

  it("shrinks r, not the copy, when that rule forces r below 0.38 h", () => {
    // A narrow, tall window: the height would allow a big core, the width does not.
    const stage: Rect = { left: 0, top: 76, width: 960, height: 1000 };
    const copyRight = 500;
    const p = heroCorePlacement({ stage, copyRight });
    expect(p.r).toBeLessThan(0.38 * stage.height);
    expect(p.r).toBeGreaterThan(0);
    expect(clusterLeft(p)).toBeGreaterThanOrEqual(copyRight + COPY_GAP_PX - 1e-6);
  });

  it("collapses to r = 0 when there is no room right of the copy", () => {
    const stage: Rect = { left: 0, top: 0, width: 600, height: 700 };
    expect(heroCorePlacement({ stage, copyRight: 590 }).r).toBe(0);
    expect(heroCorePlacement({ stage, copyRight: 700 }).r).toBe(0);
  });
});

describe("heroInset: the shared left edge", () => {
  // The header, the section titles and the hero copy all start at the frame's
  // left edge: max(0, (container - 84rem) / 2) + clamp(24px, 5cqi, 80px).
  it.each([
    [896, 44.8],
    [1248, 62.4],
    [1334, 66.7],
  ])("at a %ipx container the inset is the plain 5cqi gutter", (container, expected) => {
    expect(heroInset(container)).toBeCloseTo(expected, 5);
  });

  it("adds half of what is left of the frame once the container passes 84rem", () => {
    expect(heroInset(1408)).toBeCloseTo((1408 - 1344) / 2 + 70.4, 5);
    expect(heroInset(1888)).toBeCloseTo((1888 - 1344) / 2 + 80, 5);
  });

  it("never drops below the 24px gutter", () => {
    expect(heroInset(300)).toBe(24);
  });

  it("is continuous across the frame's max width", () => {
    expect(heroInset(1344.01) - heroInset(1344)).toBeLessThan(0.1);
  });
});

describe("lockup overlap", () => {
  it.each([1280, 1366, 1440, 1536, 1920])(
    "at %ipx the Latin name overhangs the copy column on purpose, by at most 18%%",
    (vw) => {
      const { container, copyWidth } = laptopHero(vw, 900);
      const nameWidth = LATIN_NAME_EM * heroLockupPx(container);
      const overhang = (nameWidth - copyWidth) / copyWidth;
      expect(overhang).toBeGreaterThan(0.04);
      expect(overhang).toBeLessThanOrEqual(LOCKUP_MAX_OVERHANG);
    },
  );

  // Eczar sets the name about 1.46x wider than Anek's condensed cut did
  // (8.94em against 6.1em), so the clamp came down (7cqi, max 104px, became
  // 4.8cqi, max 68px) to keep the same overhang of about 12%.
  it.each([
    [896, 52],
    [1248, 0.048 * 1248],
    [1408, 0.048 * 1408],
    [1504, 68],
    [3000, 68],
  ])("at a %ipx container the lockup is %fpx (clamp(52px, 4.8cqi, 68px))", (container, px) => {
    expect(heroLockupPx(container)).toBeCloseTo(px, 5);
  });

  it("keeps the overhang within the rule at every laptop container width", () => {
    for (let container = 896; container <= 2400; container += 4) {
      const overhang = (LATIN_NAME_EM * heroLockupPx(container)) / heroCopyWidth(container) - 1;
      expect(overhang).toBeGreaterThan(0.04);
      expect(overhang).toBeLessThanOrEqual(LOCKUP_MAX_OVERHANG);
    }
  });
});

describe("lockup on phones and tablets: beside the portrait badge", () => {
  // The stacked hero puts the badge and the name in one row (hero.css): the
  // Latin name never wraps, so badge + gap + name must fit the container.
  // The page gutter is 1rem below 40rem and 2rem from there to 64rem.
  const containerAt = (vw: number) => vw - 2 * (vw >= 640 ? 32 : PAGE_GUTTER_PX);

  it.each([320, 340, 360, 375, 390, 393, 412, 414, 428, 430])(
    "at a %ipx viewport the name fits beside the badge without wrapping",
    (vw) => {
      const container = containerAt(vw);
      const row =
        heroPhoneBadgePx(container) + HERO_PHONE_GAP_PX + LATIN_NAME_EM * heroPhoneLockupPx(container);
      expect(row).toBeLessThanOrEqual(container);
    },
  );

  it("fits at every width up to the laptop split", () => {
    for (let vw = 320; vw < 1024; vw += 1) {
      const container = containerAt(vw);
      if (container >= 896) break;
      const row =
        heroPhoneBadgePx(container) + HERO_PHONE_GAP_PX + LATIN_NAME_EM * heroPhoneLockupPx(container);
      expect(row).toBeLessThanOrEqual(container);
    }
  });

  it("mirrors hero.css: min(64px, 7.8cqi) for the name, clamp(72px, 24cqi, 104px) for the badge", () => {
    expect(heroPhoneLockupPx(288)).toBeCloseTo(0.078 * 288, 5);
    expect(heroPhoneLockupPx(880)).toBe(64);
    expect(heroPhoneBadgePx(288)).toBe(72);
    expect(heroPhoneBadgePx(358)).toBeCloseTo(0.24 * 358, 5);
    expect(heroPhoneBadgePx(600)).toBe(104);
  });
});

describe("heroCorePlacement: phone band", () => {
  it("centres the core in the band when there is no copy column beside it", () => {
    const stage: Rect = { left: 16, top: 60, width: 343, height: 186 };
    const p = heroCorePlacement({ stage, copyRight: null });
    expect(p.cx).toBeCloseTo(16 + 343 / 2, 5);
    expect(p.cy).toBeCloseTo(60 + 186 / 2, 5);
    expect(p.r).toBeCloseTo(0.56 * 186, 5);
  });

  it("returns r = 0 for an empty or broken stage", () => {
    expect(heroCorePlacement({ stage: { left: 0, top: 0, width: 0, height: 200 }, copyRight: null }).r).toBe(0);
    expect(heroCorePlacement({ stage: { left: 0, top: 0, width: NaN, height: 200 }, copyRight: 10 }).r).toBe(0);
  });
});

describe("heroCorePlacement: keepOut (launcher + 24px)", () => {
  it.each([
    [1366, 768],
    [1440, 900],
    [1280, 720],
    [1536, 864],
  ])("%ix%i: the floor ellipse never reaches the launcher zone", (vw, vh) => {
    const { stage, copyRight, viewRight } = laptopHero(vw, vh);
    const keepOut = keepOutAround(launcherBox(vw, vh));
    const free = heroCorePlacement({ stage, copyRight, viewRight });
    const p = heroCorePlacement({ stage, copyRight, viewRight, keepOut });
    expect(p.r).toBeLessThanOrEqual(free.r);
    expect(p.cx).toBe(free.cx);
    expect(p.cy).toBe(free.cy);
    expect(ellipseIntersectsRect(floorEllipse(p), keepOut)).toBe(false);
    // And the real projected floor ring agrees.
    for (const [x, y] of projectedRing(p, vw, vh)) {
      const inside =
        x > keepOut.left &&
        x < keepOut.left + keepOut.width &&
        y > keepOut.top &&
        y < keepOut.top + keepOut.height;
      expect(inside).toBe(false);
    }
  });

  it("shrinks only as much as it must (stays within 2px of touching)", () => {
    const { stage, copyRight, viewRight } = laptopHero(1366, 768);
    const keepOut = keepOutAround(launcherBox(1366, 768));
    const p = heroCorePlacement({ stage, copyRight, viewRight, keepOut });
    const bigger = { ...p, r: p.r + 2 };
    const free = heroCorePlacement({ stage, copyRight, viewRight });
    if (p.r < free.r) {
      expect(ellipseIntersectsRect(floorEllipse(bigger), keepOut)).toBe(true);
    }
  });

  it("leaves r alone when the keep-out is far away", () => {
    const { stage, copyRight, viewRight } = laptopHero(1440, 900);
    const free = heroCorePlacement({ stage, copyRight, viewRight });
    const far: Rect = { left: 0, top: 0, width: 10, height: 10 };
    expect(heroCorePlacement({ stage, copyRight, viewRight, keepOut: far }).r).toBe(free.r);
  });

  it("gives r = 0 when the keep-out covers the core's centre", () => {
    const { stage, copyRight, viewRight } = laptopHero(1440, 900);
    const free = heroCorePlacement({ stage, copyRight, viewRight });
    const over: Rect = { left: free.cx - 5, top: free.cy - 5, width: 10, height: 10 };
    expect(heroCorePlacement({ stage, copyRight, viewRight, keepOut: over }).r).toBe(0);
  });

  it("keepOutAround grows the box by the margin on every side", () => {
    expect(keepOutAround({ left: 100, top: 200, width: 72, height: 72 })).toEqual({
      left: 76,
      top: 176,
      width: 120,
      height: 120,
    });
  });
});

// ---------------------------------------------------------------------------
// The extents above are constants; check them against the renderer's real
// camera (core-renderer.ts placeCamera): fov 30, target (0, 1.4, 0), 5.6 world
// units fitted to r px, elevation 0.62 with the pointer lean of ±0.05 and
// azimuth 0.6 ± 0.12.

const CORE_RADIUS = 5.6;
const PRISM_R = 0.9;
const FLOOR_RING = 7 * 0.86; // the visible ring in the floor shader
const MAX_PRISM_H = 4.6;

function camera(p: CorePlacement, vw: number, vh: number, az = 0.6, el = 0.62) {
  const cam = new PerspectiveCamera(30, vw / vh, 0.1, 1000);
  const target = new Vector3(0, 1.4, 0);
  const halfFov = (30 * Math.PI) / 360;
  const dist = (CORE_RADIUS * (vh / 2)) / (Math.max(40, p.r) * Math.tan(halfFov));
  cam.position.set(
    target.x + dist * Math.cos(el) * Math.sin(az),
    target.y + dist * Math.sin(el),
    target.z + dist * Math.cos(el) * Math.cos(az),
  );
  cam.lookAt(target);
  cam.setViewOffset(vw, vh, vw / 2 - p.cx, vh / 2 - p.cy, vw, vh);
  cam.updateMatrixWorld();
  return cam;
}

function toScreen(cam: PerspectiveCamera, v: Vector3, vw: number, vh: number): [number, number] {
  const n = v.clone().project(cam);
  return [((n.x + 1) / 2) * vw, ((1 - n.y) / 2) * vh];
}

function projectedRing(p: CorePlacement, vw: number, vh: number, az = 0.6, el = 0.62) {
  const cam = camera(p, vw, vh, az, el);
  const points: [number, number][] = [];
  for (let i = 0; i < 180; i++) {
    const a = (i / 180) * Math.PI * 2;
    points.push(toScreen(cam, new Vector3(FLOOR_RING * Math.cos(a), 0, FLOOR_RING * Math.sin(a)), vw, vh));
  }
  return points;
}

const LEANS: [number, number][] = [];
for (const az of [0.48, 0.6, 0.72]) for (const el of [0.57, 0.62, 0.67]) LEANS.push([az, el]);

describe("extent constants match the renderer's camera", () => {
  it.each([150, 270, 346, 420])("floor ring at r = %i lies inside FLOOR_ELLIPSE", (r) => {
    const p = { cx: 900, cy: 480, r };
    const e = floorEllipse(p);
    for (const [az, el] of LEANS) {
      for (const [x, y] of projectedRing(p, 1440, 900, az, el)) {
        const d = ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2;
        expect(d).toBeLessThanOrEqual(1);
      }
    }
  });

  it.each([150, 270, 346, 420])("prisms at r = %i stay inside CLUSTER_EXTENT", (r) => {
    const p = { cx: 900, cy: 480, r };
    const cells = hexSpiral(26).map((cell) => axialToWorld(cell, 1));
    for (const [az, el] of LEANS) {
      const cam = camera(p, 1440, 900, az, el);
      for (const cell of cells) {
        for (let k = 0; k < 6; k++) {
          const th = Math.PI / 2 + (k * Math.PI) / 3;
          for (const y of [0, MAX_PRISM_H]) {
            const [x, sy] = toScreen(
              cam,
              new Vector3(cell.x + PRISM_R * Math.sin(th), y, cell.z + PRISM_R * Math.cos(th)),
              1440,
              900,
            );
            expect(p.cx - x).toBeLessThanOrEqual(CLUSTER_EXTENT.left * r);
            expect(x - p.cx).toBeLessThanOrEqual(CLUSTER_EXTENT.right * r);
            expect(p.cy - sy).toBeLessThanOrEqual(CLUSTER_EXTENT.up * r);
            expect(sy - p.cy).toBeLessThanOrEqual(CLUSTER_EXTENT.down * r);
          }
        }
      }
    }
  });

  // The camera drifts round the core for as long as the hero is on screen, so
  // the extents the staging relies on (left: the copy gap; down: the exit's
  // travel) must hold from every side, not only near the resting azimuth.
  // Perspective grows with r / viewport height, and the placement keeps r at
  // or under 0.42 of the stage (the viewport less the header): test there.
  it.each([
    [1280, 720, 270],
    [1440, 900, 150],
    [1440, 900, 346],
    [1920, 1080, 420],
  ])("%ix%i at r = %i: the left and down extents hold at every azimuth", (vw, vh, r) => {
    expect(r).toBeLessThanOrEqual(0.42 * (vh - HEADER_PX) + 1);
    const p = { cx: vw * 0.62, cy: vh * 0.55, r };
    const cells = hexSpiral(26).map((cell) => axialToWorld(cell, 1));
    // The worst case over every sample, asserted once: an expect per point
    // (~60k of them) made this sweep take seconds, not the projection.
    let left = -Infinity;
    let down = -Infinity;
    for (let az = 0; az < Math.PI * 2; az += 0.1) {
      for (const el of [0.57, 0.62, 0.67]) {
        const cam = camera(p, vw, vh, az, el);
        for (const cell of cells) {
          for (let k = 0; k < 6; k++) {
            const th = Math.PI / 2 + (k * Math.PI) / 3;
            for (const y of [0, MAX_PRISM_H]) {
              const [x, sy] = toScreen(
                cam,
                new Vector3(cell.x + PRISM_R * Math.sin(th), y, cell.z + PRISM_R * Math.cos(th)),
                vw,
                vh,
              );
              left = Math.max(left, p.cx - x);
              down = Math.max(down, sy - p.cy);
            }
          }
        }
      }
    }
    expect(left).toBeLessThanOrEqual(CLUSTER_EXTENT.left * r);
    expect(down).toBeLessThanOrEqual(CLUSTER_EXTENT.down * r);
  });

  it("FLOOR_ELLIPSE contains the core's centre (so shrinking r is monotone)", () => {
    const e = floorEllipse({ cx: 0, cy: 0, r: 100 });
    expect(((0 - e.cy) / e.ry) ** 2).toBeLessThan(1);
    expect(FLOOR_ELLIPSE.dy).toBeLessThan(FLOOR_ELLIPSE.ry);
  });
});

// ---------------------------------------------------------------------------
// Staging: where the core is, and how present it is (K4). The renderer reads
// only these presence values.

const HERO: CorePlacement = { cx: 1048, cy: 529, r: 328 };
const at = (k: number, still = false, hero: CorePlacement | null = HERO) =>
  resolveCoreStage({ hero, exit: k, still });

describe("heroExitProgress", () => {
  const travel = heroTravel(HERO);

  it("travels until the lowest prisms have passed the top of the view", () => {
    expect(travel).toBeCloseTo(HERO.cy + CLUSTER_EXTENT.down * HERO.r, 6);
  });

  it("is 0 in place (and while the page rubber-bands above the top)", () => {
    expect(heroExitProgress(0, travel)).toBe(0);
    expect(heroExitProgress(-40, travel)).toBe(0);
  });

  it("rises with the scroll and reaches 1 once the cluster is gone", () => {
    let prev = -1;
    for (let y = 0; y <= travel + 200; y += 25) {
      const k = heroExitProgress(y, travel);
      expect(k).toBeGreaterThanOrEqual(prev);
      prev = k;
    }
    expect(heroExitProgress(travel / 2, travel)).toBeCloseTo(0.5, 6);
    expect(heroExitProgress(travel, travel)).toBe(1);
    expect(heroExitProgress(travel * 3, travel)).toBe(1);
  });

  it("is 1 on a page without a hero, and safe with broken input", () => {
    expect(heroExitProgress(0, null)).toBe(1);
    expect(heroExitProgress(0, 0)).toBe(0);
    expect(heroExitProgress(10, 0)).toBe(1);
    expect(heroExitProgress(Number.NaN, travel)).toBe(0);
  });
});

describe("exitHeight: prisms settle as the hero leaves", () => {
  const MAX_RING = 3;

  it("is full height before the exit and 0.35x once settled, on every ring", () => {
    for (let ring = 0; ring <= MAX_RING; ring++) {
      expect(exitHeight(0, ring, MAX_RING)).toBe(1);
      expect(exitHeight(1, ring, MAX_RING)).toBeCloseTo(EXIT_HEIGHT, 9);
    }
  });

  it("never rises again as the exit goes on, and never drops below 0.35x", () => {
    for (let ring = 0; ring <= MAX_RING; ring++) {
      let prev = 1;
      for (let s = 0; s <= 1.0001; s += 0.01) {
        const h = exitHeight(s, ring, MAX_RING);
        expect(h).toBeLessThanOrEqual(prev + 1e-12);
        expect(h).toBeGreaterThanOrEqual(EXIT_HEIGHT - 1e-12);
        prev = h;
      }
    }
  });

  it("settles the inner ring first", () => {
    for (const s of [0.2, 0.4, 0.6]) {
      for (let ring = 1; ring <= MAX_RING; ring++) {
        expect(exitHeight(s, ring - 1, MAX_RING)).toBeLessThanOrEqual(exitHeight(s, ring, MAX_RING));
      }
    }
    expect(exitHeight(0.3, 0, MAX_RING)).toBeLessThan(exitHeight(0.3, MAX_RING, MAX_RING));
  });

  it("is safe with out-of-range input", () => {
    expect(exitHeight(-1, 0, MAX_RING)).toBe(1);
    expect(exitHeight(2, 3, MAX_RING)).toBeCloseTo(EXIT_HEIGHT, 9);
    expect(exitHeight(0.5, 0, 0)).toBeGreaterThanOrEqual(EXIT_HEIGHT);
    expect(exitHeight(Number.NaN, 1, MAX_RING)).toBe(1);
  });
});

describe("resolveCoreStage: hero", () => {
  it("sits exactly on the hero placement, fully present, in place", () => {
    const p = at(0);
    expect(p.kind).toBe("hero");
    expect([p.cx, p.cy, p.r]).toEqual([HERO.cx, HERO.cy, HERO.r]);
    expect(p.el).toBe(HERO_EL);
    expect(p.opacity).toBe(1);
    expect(p.dim).toBe(1);
    expect(p.glow).toBe(1);
    expect(p.settle).toBe(0);
    expect(p.orb).toBe(1);
    expect(p.threads).toBe(1);
    expect(p.dust).toBe(1);
    expect(p.ambient).toBe(true);
    expect(p.clip).toBeNull();
  });

  it("follows the hero rect while scrolling: no lag, whatever the progress", () => {
    for (const k of [0, 0.3, 0.7, 0.95]) {
      const scrolled = { ...HERO, cy: HERO.cy - 400 * k };
      const p = resolveCoreStage({ hero: scrolled, exit: k, still: false });
      expect(p.cy).toBe(scrolled.cy);
      expect(p.cx).toBe(scrolled.cx);
      expect(p.r).toBe(scrolled.r);
    }
  });

  it("holds its shape until k = 0.1, settles by 0.6, then fades out by 1", () => {
    expect(at(0.1).settle).toBe(0);
    expect(at(0.35).settle).toBeCloseTo(0.5, 9);
    expect(at(0.6).settle).toBe(1);
    expect(at(0.6).opacity).toBe(1);
    expect(at(0.8).opacity).toBeCloseTo(0.5, 9);
    expect(at(0.6).glow).toBeCloseTo(EXIT_GLOW, 9);
    expect(at(0.9).glow).toBeCloseTo(EXIT_GLOW, 9);
  });

  it("exit height(k) is monotonic and 1 at k <= 0.1 (the test the reviewers asked for)", () => {
    for (let ring = 0; ring <= 3; ring++) {
      let prev = 1;
      for (let k = 0; k <= 1; k += 0.02) {
        const h = exitHeight(at(k).settle, ring, 3);
        if (k <= 0.1) expect(h).toBe(1);
        expect(h).toBeLessThanOrEqual(prev + 1e-12);
        prev = h;
      }
    }
  });

  it("every presence value only falls as the hero leaves", () => {
    const keys = ["opacity", "dim", "glow", "orb", "threads"] as const;
    let prev = at(0);
    for (let k = 0.02; k < 1; k += 0.02) {
      const p = at(k);
      for (const key of keys) expect(p[key]).toBeLessThanOrEqual(prev[key] + 1e-12);
      expect(p.settle).toBeGreaterThanOrEqual(prev.settle);
      prev = p;
    }
  });

  it("is gone (nothing to draw) once the hero has left", () => {
    const p = at(1);
    expect(p.kind).toBe("none");
    expect(p.opacity).toBe(0);
    expect(p.ambient).toBe(false);
  });

  it("still or reduced motion: no glide, one step at k = 0.5", () => {
    for (const k of [0, 0.2, 0.49]) {
      const p = at(k, true);
      expect(p.kind).toBe("hero");
      expect(p.opacity).toBe(1);
      expect(p.settle).toBe(0);
      expect(p.glow).toBe(1);
      expect(p.ambient).toBe(false);
    }
    for (const k of [0.5, 0.7, 1]) {
      expect(at(k, true).kind).toBe("none");
      expect(at(k, true).opacity).toBe(0);
    }
  });

  it("draws nothing without a hero, with no room for one, or with broken input", () => {
    expect(at(0, false, null).kind).toBe("none");
    expect(at(0, false, { cx: 10, cy: 10, r: 0 }).kind).toBe("none");
    expect(at(0, false, { cx: Number.NaN, cy: 10, r: 100 }).kind).toBe("none");
    expect(at(Number.NaN).kind).toBe("hero");
    expect(at(Number.NaN).opacity).toBe(1);
  });
});

describe("resolveCoreStage: dock (Phase B contract)", () => {
  const dock: Rect = { left: 976, top: 180, width: 440, height: 200 };

  it("an open window with a dock takes the core, fully lit, dust off, clipped to the dock", () => {
    const p = resolveCoreStage({ hero: HERO, exit: 0, still: false, open: true, dock });
    expect(p.kind).toBe("dock");
    expect(p.cx).toBeCloseTo(dock.left + dock.width / 2, 9);
    expect(p.cy).toBeGreaterThan(dock.top + dock.height / 2);
    expect(p.r).toBeGreaterThan(0);
    expect(p.r).toBeLessThanOrEqual(0.52 * dock.height + 1e-9);
    expect(p.el).toBe(DOCK_EL);
    expect([p.opacity, p.dim, p.glow, p.orb, p.threads]).toEqual([1, 1, 1, 1, 1]);
    expect(p.dust).toBe(0);
    expect(p.settle).toBe(0);
    expect(p.clip).toEqual(dock);
  });

  it("is present even where k reads 1: a project page, or below the hero", () => {
    for (const p of [
      resolveCoreStage({ hero: null, exit: 1, still: false, open: true, dock }),
      resolveCoreStage({ hero: HERO, exit: 1, still: true, open: true, dock }),
    ]) {
      expect(p.kind).toBe("dock");
      expect(p.opacity).toBe(1);
      expect(p.orb).toBe(1);
    }
  });

  it("open without a dock box falls back to the hero", () => {
    for (const box of [null, undefined, { ...dock, width: 0 }]) {
      const p = resolveCoreStage({ hero: HERO, exit: 0, still: false, open: true, dock: box });
      expect(p.kind).toBe("hero");
      expect(p.cx).toBe(HERO.cx);
    }
  });

  it("a dock box while closed is ignored", () => {
    expect(resolveCoreStage({ hero: HERO, exit: 0, still: false, open: false, dock }).kind).toBe("hero");
  });
});

// ---------------------------------------------------------------------------
// Phase B (S2c): the core flies into the copilot window's dock.

// The dock space as copilot-window.css lays it out in the laptop window: the
// window is min(440px, 100vw - 48px) wide with a 1px border and 20px padding;
// in 3D the caption takes 38% of the row and a 12px gap, the core the rest.
// Full height min(200px, 24dvh), the strip min(120px, 15dvh).
const DOCK_W = (440 - 2 - 40) * 0.62 - 12;
function dockAt(vw: number, vh: number, size: "full" | "strip"): Rect {
  const height = size === "full" ? Math.min(200, 0.24 * vh) : Math.min(120, 0.15 * vh);
  return { left: vw - 24 - 440 + 21, top: 140, width: DOCK_W, height };
}

// The renderer's camera for a placement, as core-renderer placeCamera sets it.
function dockCamera(p: CorePlacement, vw: number, vh: number, az: number, el: number) {
  const cam = new PerspectiveCamera(30, vw / vh, 0.1, 5000);
  const target = new Vector3(0, 1.4, 0);
  const halfFov = (30 * Math.PI) / 360;
  const dist = (CORE_RADIUS * (vh / 2)) / (p.r * Math.tan(halfFov));
  cam.position.set(
    target.x + dist * Math.cos(el) * Math.sin(az),
    target.y + dist * Math.sin(el),
    target.z + dist * Math.cos(el) * Math.cos(az),
  );
  cam.lookAt(target);
  cam.setViewOffset(vw, vh, vw / 2 - p.cx, vh / 2 - p.cy, vw, vh);
  cam.updateMatrixWorld();
  return cam;
}

// Every point the dock must hold: each prism's six corners at the floor and
// at its tallest (skyline + glow, section, hover, breathing and a ripple),
// and the question orb at its largest pulse.
function dockPoints(): Vector3[] {
  const points: Vector3[] = [];
  hexSpiral(26).forEach((cell, index) => {
    const { x, z } = axialToWorld(cell, 1);
    const top = baseHeight(index, ringOfCell(cell)) + MAX_RISE;
    for (let k = 0; k < 6; k++) {
      const th = Math.PI / 2 + (k * Math.PI) / 3;
      for (const y of [0, top]) {
        points.push(new Vector3(x + PRISM_R * Math.sin(th), y, z + PRISM_R * Math.cos(th)));
      }
    }
  });
  for (const [dx, dy, dz] of [
    [0, 1, 0],
    [0, -1, 0],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
  ]) {
    points.push(new Vector3(dx * ORB_MAX_RADIUS, ORB_HEIGHT + dy * ORB_MAX_RADIUS, dz * ORB_MAX_RADIUS));
  }
  return points;
}

function ringOfCell({ q, r }: { q: number; r: number }): number {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

// Each case sweeps every azimuth through a real camera (~2s alone). Under a
// loaded full-suite run (or a shared CI runner) that can pass the default 5s.
describe("dockPlacement: the core fits its dock, seen through the real camera", { timeout: 30_000 }, () => {
  const points = dockPoints();

  it.each([
    [1280, 720, "full"],
    [1280, 720, "strip"],
    [2560, 1600, "full"],
    [2560, 1600, "strip"],
  ] as const)(
    "%ix%i, %s dock: cluster corners, prism tops and the orb stay 8px inside it from every side",
    (vw, vh, size) => {
      const dock = dockAt(vw, vh, size);
      const p = dockPlacement(dock);
      expect(p.r).toBeGreaterThan(40);
      const inner = {
        left: dock.left + DOCK_INSET_PX,
        top: dock.top + DOCK_INSET_PX,
        right: dock.left + dock.width - DOCK_INSET_PX,
        bottom: dock.top + dock.height - DOCK_INSET_PX,
      };
      // The camera drifts all the way round in the dock and leans with the
      // pointer (azimuth ± 0.12, elevation ± 0.05).
      // The projected bounds over every sample, asserted once (an expect per
      // point, ~500k of them, was what made this sweep slow).
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let az = 0; az < Math.PI * 2; az += 0.05) {
        for (const lean of [-1, 0, 1]) {
          const cam = dockCamera(p, vw, vh, az + 0.12 * lean, DOCK_EL - 0.05 * lean);
          for (const point of points) {
            const [x, y] = toScreen(cam, point, vw, vh);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      }
      expect(minX).toBeGreaterThanOrEqual(inner.left);
      expect(maxX).toBeLessThanOrEqual(inner.right);
      expect(minY).toBeGreaterThanOrEqual(inner.top);
      expect(maxY).toBeLessThanOrEqual(inner.bottom);
    },
  );

  it("is centred across the dock and as large as its height allows in a wide dock", () => {
    const dock: Rect = { left: 900, top: 140, width: 240, height: 180 };
    const p = dockPlacement(dock);
    expect(p.cx).toBeCloseTo(1020, 9);
    // Height-bound: a little taller dock gives a larger core, a wider one does not.
    expect(dockPlacement({ ...dock, height: 200 }).r).toBeGreaterThan(p.r);
    expect(dockPlacement({ ...dock, width: 400 }).r).toBeCloseTo(p.r, 9);
  });

  it("is width-bound in a narrow dock", () => {
    const dock: Rect = { left: 0, top: 0, width: 120, height: 400 };
    expect(dockPlacement({ ...dock, width: 140 }).r).toBeGreaterThan(dockPlacement(dock).r);
  });

  it("gives r = 0 for a dock with no room", () => {
    expect(dockPlacement({ left: 0, top: 0, width: 10, height: 10 }).r).toBe(0);
    expect(dockPlacement({ left: 0, top: 0, width: Number.NaN, height: 100 }).r).toBe(0);
  });
});

describe("resolveCoreStage: the three endpoints (hero, dock, none at the launcher)", () => {
  const dock: Rect = { left: 997, top: 160, width: 235, height: 200 };
  const launcher: Rect = { left: 1344, top: 804, width: 72, height: 72 };

  it("dock: placed by dockPlacement, fully present, clipped to the visible part", () => {
    const clip: Rect = { left: 998, top: 161, width: 233, height: 120 };
    const p = resolveCoreStage({ hero: HERO, exit: 0, still: false, open: true, dock, clip });
    const place = dockPlacement(dock);
    expect(p.kind).toBe("dock");
    expect([p.cx, p.cy, p.r]).toEqual([place.cx, place.cy, place.r]);
    expect(p.clip).toEqual(clip);
    expect(p.opacity).toBe(1);
    expect(p.dust).toBe(0);
  });

  it("dock: an empty visible part (a tucked window) draws nothing, but stays the dock", () => {
    const clip: Rect = { left: 998, top: 161, width: 0, height: 0 };
    const p = resolveCoreStage({ hero: HERO, exit: 0, still: false, open: true, dock, clip });
    expect(p.kind).toBe("dock");
    const out = { x: 0, y: 0, width: 0, height: 0, area: 0 };
    expect(scissorBox(out, p.cx - 200, p.cy - 200, p.cx + 200, p.cy + 200, 1440, 900, p.clip, 6)).toBe(false);
  });

  it("dock: a dock too small for the core falls back to the hero", () => {
    const tiny: Rect = { left: 1000, top: 200, width: 12, height: 12 };
    expect(resolveCoreStage({ hero: HERO, exit: 0, still: false, open: true, dock: tiny }).kind).toBe("hero");
  });

  it("dock: still is still docked, with no ambient motion", () => {
    const p = resolveCoreStage({ hero: null, exit: 1, still: true, open: true, dock });
    expect(p.kind).toBe("dock");
    expect(p.ambient).toBe(false);
  });

  it("none sits on the launcher's hex: small, invisible, drawing nothing", () => {
    const p = resolveCoreStage({ hero: null, exit: 1, still: false, launcher });
    expect(p.kind).toBe("none");
    expect(p.cx).toBe(1380);
    expect(p.cy).toBe(840);
    expect(p.r).toBe(LAUNCHER_R);
    expect(p.opacity).toBe(0);
    expect(p.clip).toBeNull();
    expect(launcherPresence(launcher)).toEqual(p);
  });

  it("none without a launcher box is the plain empty presence", () => {
    expect(resolveCoreStage({ hero: null, exit: 1, still: false })).toEqual(nonePresence());
  });

  it("hero is unchanged by a launcher box", () => {
    const a = resolveCoreStage({ hero: HERO, exit: 0.3, still: false });
    const b = resolveCoreStage({ hero: HERO, exit: 0.3, still: false, launcher });
    expect(b).toEqual(a);
  });

  it("isDocked tells the dock apart from the other two", () => {
    expect(isDocked(resolveCoreStage({ hero: HERO, exit: 0, still: false, open: true, dock }))).toBe(true);
    expect(isDocked(resolveCoreStage({ hero: HERO, exit: 0, still: false }))).toBe(false);
    expect(isDocked(resolveCoreStage({ hero: null, exit: 1, still: false, launcher }))).toBe(false);
  });
});

describe("the dock's rects: untransformed layout, visible part, clip", () => {
  it("windowLayoutBox undoes the open animation's scale about the bottom-right corner", () => {
    // 440x700 window at right 24, bottom 108 on a 1440x900 viewport, at scale .94.
    const layout: Rect = { left: 976, top: 92, width: 440, height: 700 };
    const s = 0.94;
    const visual: Rect = {
      left: 1416 - 440 * s,
      top: 792 - 700 * s,
      width: 440 * s,
      height: 700 * s,
    };
    const back = windowLayoutBox(visual, 440, 700);
    expect(back.left).toBeCloseTo(layout.left, 9);
    expect(back.top).toBeCloseTo(layout.top, 9);
    expect(back.width).toBe(440);
    expect(back.height).toBe(700);
  });

  it("mapRect carries the dock from the window as drawn to the window as laid out", () => {
    const layout: Rect = { left: 976, top: 92, width: 440, height: 700 };
    const s = 0.94;
    const visual = windowLayoutBox(layout, 440, 700); // identity at scale 1
    expect(visual).toEqual(layout);
    const scaled: Rect = { left: 1416 - 440 * s, top: 792 - 700 * s, width: 440 * s, height: 700 * s };
    const dockLaid: Rect = { left: 997, top: 160, width: 235, height: 200 };
    const dockDrawn: Rect = {
      left: 1416 - (1416 - 997) * s,
      top: 792 - (792 - 160) * s,
      width: 235 * s,
      height: 200 * s,
    };
    const back = mapRect(dockDrawn, scaled, layout);
    expect(back.left).toBeCloseTo(dockLaid.left, 9);
    expect(back.top).toBeCloseTo(dockLaid.top, 9);
    expect(back.width).toBeCloseTo(dockLaid.width, 9);
    expect(back.height).toBeCloseTo(dockLaid.height, 9);
  });

  it("mapRect is the identity when the window is not transformed, and safe when it has no size", () => {
    const win: Rect = { left: 976, top: 92, width: 440, height: 700 };
    const dock: Rect = { left: 997, top: 160, width: 235, height: 200 };
    expect(mapRect(dock, win, win)).toEqual(dock);
    expect(mapRect(dock, { ...win, width: 0 }, win)).toEqual(dock);
  });

  it("windowVisibleRect is the whole window, or only its title strip when tucked", () => {
    const win: Rect = { left: 976, top: 736, width: 440, height: 700 };
    expect(windowVisibleRect(win, false)).toEqual(win);
    expect(windowVisibleRect(win, true)).toEqual({ ...win, height: 56 });
  });

  it("dockClip is the dock inside the window's visible part, inset by 1px", () => {
    const dock: Rect = { left: 997, top: 160, width: 235, height: 200 };
    const win: Rect = { left: 976, top: 92, width: 440, height: 700 };
    expect(dockClip(dock, win)).toEqual({ left: 998, top: 161, width: 233, height: 198 });
    // Scrolled half out of the window's top.
    const clipped = dockClip({ ...dock, top: 40 }, win);
    expect(clipped).toEqual({ left: 998, top: 93, width: 233, height: 146 });
  });

  it("dockClip stops at the header's visible box when the dock is taller than it", () => {
    // A short laptop viewport: the header scrollport is 118px tall, the dock 81px
    // but scrolled so its bottom 25px sit below the header, over the thread.
    const dock: Rect = { left: 997, top: 62, width: 235, height: 81 };
    const win: Rect = { left: 976, top: 0, width: 440, height: 544 };
    const head: Rect = { left: 976, top: 0, width: 440, height: 118 };
    const clip = dockClip(dock, intersectRect(win, head));
    expect(clip.top + clip.height).toBe(117);
    expect(intersectRect(head, { left: 0, top: 200, width: 10, height: 10 })).toMatchObject({
      width: 0,
      height: 0,
    });
  });

  it("dockClip is empty (zero size, never negative) when the dock is not visible", () => {
    const dock: Rect = { left: 997, top: 160, width: 235, height: 200 };
    const strip: Rect = { left: 976, top: 736, width: 440, height: 56 };
    const clip = dockClip(dock, strip);
    expect(clip.width).toBe(0);
    expect(clip.height).toBe(0);
  });
});

describe("flights: open and close carry the core on a critically damped spring", () => {
  const dockBox: Rect = { left: 997, top: 160, width: 235, height: 200 };
  const launcher: Rect = { left: 1344, top: 804, width: 72, height: 72 };
  const hero = resolveCoreStage({ hero: HERO, exit: 0, still: false });
  const docked = resolveCoreStage({ hero: HERO, exit: 0, still: false, open: true, dock: dockBox });
  const none = launcherPresence(launcher);

  function fly(from: CorePresence, to: CorePresence | ((t: number) => CorePresence), dt = 1 / 60) {
    const flight = createFlight();
    startFlight(flight, from);
    const out = nonePresence();
    const frames: CorePresence[] = [];
    let t = 0;
    let flying = true;
    while (flying && t < 3) {
      t += dt;
      const target = typeof to === "function" ? to(t) : to;
      flying = stepFlight(flight, target, dt, out);
      frames.push({ ...out, clip: out.clip ? { ...out.clip } : null });
    }
    return { frames, t, flight };
  }

  it("hero to dock: lands exactly on the dock, clipped to it, once", () => {
    const { frames, t } = fly(hero, docked);
    const last = frames[frames.length - 1];
    expect(last).toEqual(docked);
    expect(t).toBeLessThanOrEqual(FLIGHT_MAX_S);
    for (const frame of frames.slice(0, -1)) {
      expect(frame.kind).toBe("flight");
      expect(frame.clip).toBeNull();
    }
  });

  it("takes about 450ms: most of the way there by then, without overshooting", () => {
    const { frames } = fly(hero, docked);
    const at450 = frames[Math.round(0.45 * 60) - 1];
    const covered = (hero.cx - at450.cx) / (hero.cx - docked.cx);
    expect(covered).toBeGreaterThan(0.95);
    let prev = Infinity;
    for (const frame of frames) {
      const d = Math.hypot(frame.cx - docked.cx, frame.cy - docked.cy) + Math.abs(frame.r - docked.r);
      expect(d).toBeLessThanOrEqual(prev + 1e-9);
      prev = d;
      // r and el pass between the endpoints, never beyond them.
      expect(frame.r).toBeLessThanOrEqual(hero.r + 1e-9);
      expect(frame.r).toBeGreaterThanOrEqual(docked.r - 1e-9);
      expect(frame.el).toBeLessThanOrEqual(HERO_EL + 1e-9);
      expect(frame.el).toBeGreaterThanOrEqual(DOCK_EL - 1e-9);
    }
  });

  it("blends the presence too: dust goes, the rest stays lit", () => {
    const { frames } = fly(hero, docked);
    let prev = 1;
    for (const frame of frames) {
      expect(frame.dust).toBeLessThanOrEqual(prev + 1e-12);
      expect(frame.opacity).toBe(1);
      prev = frame.dust;
    }
    expect(frames[frames.length - 1].dust).toBe(0);
  });

  it("dock to the launcher: shrinks to ~24px into the hex and fades out, then draws nothing", () => {
    const { frames } = fly(docked, none);
    const last = frames[frames.length - 1];
    expect(last.kind).toBe("none");
    expect(last.r).toBe(LAUNCHER_R);
    expect(last.opacity).toBe(0);
    let prev = 1;
    for (const frame of frames) {
      expect(frame.opacity).toBeLessThanOrEqual(prev + 1e-12);
      prev = frame.opacity;
    }
  });

  it("launcher to dock: grows out of the hex from nothing", () => {
    const { frames } = fly(none, docked);
    expect(frames[0].opacity).toBeGreaterThanOrEqual(0);
    expect(frames[0].opacity).toBeLessThan(0.1);
    expect(frames[0].r).toBeLessThan(LAUNCHER_R + 10);
    expect(frames[frames.length - 1]).toEqual(docked);
  });

  it("follows a moving target (the window still opening, the page scrolling) and lands on where it ends", () => {
    const moving = (t: number) => ({ ...docked, cy: docked.cy + 40 * Math.max(0, 1 - t / 0.24) });
    const { frames } = fly(hero, moving);
    expect(frames[frames.length - 1]).toEqual(docked);
  });

  it("a reversal mid-flight carries on from where the core is, without a jump", () => {
    const flight = createFlight();
    const out = nonePresence();
    startFlight(flight, hero);
    for (let i = 0; i < 12; i++) stepFlight(flight, docked, 1 / 60, out);
    const before = { cx: out.cx, cy: out.cy, r: out.r };
    // The window closes again: fly back from the current (flying) presence.
    startFlight(flight, out);
    stepFlight(flight, hero, 1 / 60, out);
    expect(Math.abs(out.cx - before.cx)).toBeLessThan(40);
    expect(Math.abs(out.r - before.r)).toBeLessThan(20);
    let flying = true;
    for (let i = 0; i < 600 && flying; i++) flying = stepFlight(flight, hero, 1 / 60, out);
    expect(out).toEqual(hero);
  });

  it("is stable at long frames (dt 0.05) and lands at once after a stall (dt 1s)", () => {
    const coarse = fly(hero, docked, 0.05);
    expect(coarse.frames[coarse.frames.length - 1]).toEqual(docked);
    for (const frame of coarse.frames) {
      expect(frame.r).toBeLessThanOrEqual(hero.r + 1e-9);
      expect(frame.r).toBeGreaterThanOrEqual(docked.r - 1e-9);
    }
    const stall = fly(hero, docked, 1);
    expect(stall.frames.length).toBe(1);
    expect(stall.frames[0]).toEqual(docked);
  });

  it("lands within FLIGHT_MAX_S of wall time on a slow device (dt clamped, wall time not)", () => {
    // Below 20 fps the renderer clamps dt to 0.05 while 0.2s of wall time
    // pass per frame: the spring runs slow, but the cap counts real time.
    const steps = (wallDt?: number) => {
      const flight = createFlight();
      const out = nonePresence();
      startFlight(flight, hero);
      let n = 0;
      let flying = true;
      while (flying && n < 100) {
        flying = stepFlight(flight, docked, 0.05, out, wallDt);
        n++;
      }
      return { n, out };
    };
    const slow = steps(0.2);
    expect(slow.n * 0.2).toBeLessThanOrEqual(FLIGHT_MAX_S + 0.2 + 1e-9);
    expect(slow.out).toEqual(docked);
    // Without the wall clock it would still be flying at that frame.
    expect(steps().n).toBeGreaterThan(slow.n);
  });

  it("a zero step (a scroll between frames) moves nothing", () => {
    const flight = createFlight();
    const out = nonePresence();
    startFlight(flight, hero);
    stepFlight(flight, docked, 1 / 60, out);
    const snapshot = { ...out };
    expect(stepFlight(flight, docked, 0, out)).toBe(true);
    expect(out.cx).toBe(snapshot.cx);
    expect(out.r).toBe(snapshot.r);
  });

  it("an idle flight just shows the target", () => {
    const flight = createFlight();
    const out = nonePresence();
    expect(stepFlight(flight, docked, 1 / 60, out)).toBe(false);
    expect(out).toEqual(docked);
  });

  it("flightFrom starts from what is drawn, else from the launcher", () => {
    expect(flightFrom(hero, launcher)).toBe(hero);
    expect(flightFrom(nonePresence(), launcher)).toEqual(none);
    expect(flightFrom({ ...hero, opacity: 0 }, launcher)).toEqual(none);
  });
});

describe("nonePresence", () => {
  it("is a fresh, empty presence each time (the renderer writes into it)", () => {
    const a: CorePresence = nonePresence();
    const b = nonePresence();
    expect(a).not.toBe(b);
    expect(a.kind).toBe("none");
    expect(a.opacity).toBe(0);
    expect(a.ambient).toBe(false);
  });
});

describe("launcherRestBox", () => {
  it("is the launcher's resting square in the bottom-right corner", () => {
    expect(launcherRestBox(1440, 900, 72, 24)).toEqual({ left: 1344, top: 804, width: 72, height: 72 });
    expect(launcherRestBox(390, 844, 60, 16)).toEqual({ left: 314, top: 768, width: 60, height: 60 });
  });

  it("falls back to the laptop sizes when the CSS sizes cannot be read", () => {
    expect(launcherRestBox(1440, 900, Number.NaN, Number.NaN)).toEqual(launcherRestBox(1440, 900, 72, 24));
  });
});

describe("launcherFootprint: the hex and its label capsule", () => {
  const hex = launcherRestBox(1440, 900, 72, 24);

  it("reaches left by the capsule's width less the part tucked under the hex", () => {
    // The capsule's right end sits 0.3 * size inside the hex (copy-window.css).
    const box = launcherFootprint(hex, 168);
    expect(box.left).toBeCloseTo(hex.left + 0.3 * 72 - 168, 9);
    expect(box.left + box.width).toBe(hex.left + hex.width);
    expect(box.top).toBe(hex.top);
    expect(box.height).toBe(hex.height);
  });

  it("estimates the capsule when it cannot be measured (not mounted yet)", () => {
    for (const width of [Number.NaN, 0, -5]) {
      const box = launcherFootprint(hex, width);
      // At least the idle label's capsule, about 140px left of the hex.
      expect(hex.left - box.left).toBeGreaterThanOrEqual(130);
    }
  });

  it("keeps the hex itself for a capsule narrower than the tuck", () => {
    expect(launcherFootprint(hex, 10)).toEqual(hex);
  });

  it.each([
    [1366, 768],
    [1440, 900],
    [1280, 720],
  ])("%ix%i: the hero's floor ring stays off the capsule too", (vw, vh) => {
    const { stage, copyRight, viewRight } = laptopHero(vw, vh);
    const keepOut = keepOutAround(launcherFootprint(launcherBox(vw, vh), 168));
    const p = heroCorePlacement({ stage, copyRight, viewRight, keepOut });
    expect(ellipseIntersectsRect(floorEllipse(p), keepOut)).toBe(false);
  });

  // The capsule at the laptop size (72px hex): about 164px wide.
  it.each([
    [1024, 768],
    [1366, 768],
    [1440, 900],
    [1680, 1050],
    [1920, 1080],
  ])("%ix%i: the projected floor ring stays 24px off the ~164px capsule", (vw, vh) => {
    const { stage, copyRight, viewRight } = laptopHero(vw, vh);
    const hex = launcherRestBox(vw, vh, 72, 24);
    const footprint = launcherFootprint(hex, 164);
    // The capsule reaches left of the hex: the keep-out is wider than the hex's.
    expect(hex.left - footprint.left).toBeCloseTo(164 - 0.3 * 72, 9);
    const keepOut = keepOutAround(footprint);
    const p = heroCorePlacement({ stage, copyRight, viewRight, keepOut });
    expect(ellipseIntersectsRect(floorEllipse(p), keepOut)).toBe(false);
    for (const [x, y] of projectedRing(p, vw, vh)) {
      const inside =
        x > keepOut.left &&
        x < keepOut.left + keepOut.width &&
        y > keepOut.top &&
        y < keepOut.top + keepOut.height;
      expect(inside).toBe(false);
    }
  });

  it("the estimate used before the capsule mounts covers a ~164px capsule", () => {
    const hex = launcherRestBox(1440, 900, 72, 24);
    expect(launcherFootprint(hex, Number.NaN).left).toBeLessThanOrEqual(launcherFootprint(hex, 164).left);
  });
});

describe("corePixelRatio: the pixel budget is spent on the cluster, not the viewport", () => {
  // The hero rect at 1440x900 (r ≈ 328), clipped to the canvas width.
  const heroRect = 844 * 860;

  it("reaches DPR 2 on a laptop's fine pointer", () => {
    expect(corePixelRatio({ dpr: 2, coarse: false, rectArea: heroRect, canvasArea: 1440 * 900 })).toBe(2);
  });

  it("never exceeds the device's own ratio or the per-pointer cap", () => {
    expect(corePixelRatio({ dpr: 1, coarse: false, rectArea: heroRect, canvasArea: 1440 * 900 })).toBe(1);
    expect(corePixelRatio({ dpr: 3, coarse: false, rectArea: 1000, canvasArea: 1440 * 900 })).toBe(2);
    expect(corePixelRatio({ dpr: 3, coarse: true, rectArea: 1000, canvasArea: 390 * 844 })).toBe(1.5);
  });

  it("spends at most the budget inside the rect", () => {
    const area = 1400 * 1200;
    const ratio = corePixelRatio({ dpr: 2, coarse: false, rectArea: area, canvasArea: 1920 * 1200 });
    expect(ratio).toBeLessThan(2);
    expect(area * ratio * ratio).toBeLessThanOrEqual(3e6 + 1);
  });

  it("caps the whole drawing buffer too, so a 5K screen does not allocate 15M pixels", () => {
    const canvas = 2560 * 1440;
    const ratio = corePixelRatio({ dpr: 2, coarse: false, rectArea: 300 * 300, canvasArea: canvas });
    expect(canvas * ratio * ratio).toBeLessThanOrEqual(8.3e6 + 1);
  });

  it("is safe with broken input", () => {
    expect(corePixelRatio({ dpr: Number.NaN, coarse: false, rectArea: 0, canvasArea: 0 })).toBe(1);
    expect(corePixelRatio({ dpr: 2, coarse: false, rectArea: 1e12, canvasArea: 1e12 })).toBe(0.5);
  });
});

describe("scissorBox", () => {
  const out = { x: 0, y: 0, width: 0, height: 0, area: 0 };

  it("pads the projected bounds, clips them to the canvas and flips y for WebGL", () => {
    expect(scissorBox(out, 600, 100, 1300, 800, 1440, 900, null, 10)).toBe(true);
    expect(out).toEqual({ x: 590, y: 900 - 810, width: 720, height: 720, area: 720 * 720 });
  });

  it("budgets on the rect clipped across, but not down (scrolling must not change it)", () => {
    expect(scissorBox(out, 600, -300, 1600, 500, 1440, 900, null, 0)).toBe(true);
    expect(out.width).toBe(840);
    expect(out.height).toBe(500);
    expect(out.area).toBe(840 * 800);
    expect(scissorBox(out, 600, -600, 1600, 200, 1440, 900, null, 0)).toBe(true);
    expect(out.area).toBe(840 * 800);
  });

  it("intersects with a clip box (the dock), in viewport px", () => {
    const clip: Rect = { left: 976, top: 180, width: 440, height: 200 };
    expect(scissorBox(out, 900, 100, 1500, 500, 1440, 900, clip, 0)).toBe(true);
    expect(out).toMatchObject({ x: 976, y: 900 - 380, width: 440, height: 200 });
  });

  it("is empty when the bounds are off the canvas", () => {
    expect(scissorBox(out, 600, -900, 1300, -20, 1440, 900, null, 10)).toBe(false);
    expect(scissorBox(out, 1500, 100, 1900, 800, 1440, 900, null, 0)).toBe(false);
    expect(scissorBox(out, Number.NaN, 0, 10, 10, 1440, 900, null, 0)).toBe(false);
  });
});

describe("answerRipples: an arriving answer ripples from the notes it cites", () => {
  const ids = ["a", "b", "c", "d", "e"];

  it("uses the physics' answer amplitude", () => {
    expect(ANSWER_AMP).toBe(ANSWER_RIPPLE_AMP);
  });

  it("one cited note ripples at the full answer amplitude", () => {
    expect(answerRipples(["c"], ids)).toEqual([{ index: 2, amp: ANSWER_RIPPLE_AMP }]);
  });

  it("many cited notes share it, so overlapping waves stay calm", () => {
    const ripples = answerRipples(["a", "b", "c", "d"], ids);
    expect(ripples.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    for (const r of ripples) expect(r.amp).toBeCloseTo(ANSWER_RIPPLE_AMP / 2, 9);
  });

  it("skips unknown and repeated notes", () => {
    expect(answerRipples(["x", "b", "b", ""], ids)).toEqual([{ index: 1, amp: ANSWER_RIPPLE_AMP }]);
    expect(answerRipples([], ids)).toEqual([]);
  });
});

describe("heroFallbackFit: the hero's 2D stand-in only where the copilot window leaves room", () => {
  // The fallback's box at a 1440 laptop: right of the copy column to the frame.
  const box = { left: 870, right: 1340 };

  it("fills its box when no window covers the stage", () => {
    expect(heroFallbackFit(box, null)).toEqual({ show: true, cut: 0 });
  });

  it("fills its box when the window sits clear of it (gap included)", () => {
    expect(heroFallbackFit(box, box.right + FALLBACK_WINDOW_GAP_PX)).toEqual({ show: true, cut: 0 });
    expect(heroFallbackFit(box, box.right + 400)).toEqual({ show: true, cut: 0 });
  });

  it("hides rather than leave a sliver beside the window (the 1440 laptop: ~74px left)", () => {
    // Window 440 wide, 24 in from the right edge of a 1440 viewport.
    expect(heroFallbackFit(box, 1440 - 24 - 440).show).toBe(false);
    // Just under the minimum room: still hidden.
    const edge = box.left + FALLBACK_MIN_ROOM_PX - 1;
    expect(heroFallbackFit(box, edge + FALLBACK_WINDOW_GAP_PX).show).toBe(false);
  });

  it("hides when the window covers the whole box", () => {
    expect(heroFallbackFit(box, box.left - 100).show).toBe(false);
  });

  it("with room, pulls its right edge in to clear the window by the gap", () => {
    // A 1920 viewport: frame capped, fallback from ~896 to ~1632; window at 1456.
    const wide = { left: 896, right: 1632 };
    const winLeft = 1920 - 24 - 440;
    const fit = heroFallbackFit(wide, winLeft);
    expect(fit.show).toBe(true);
    expect(wide.right - fit.cut).toBe(winLeft - FALLBACK_WINDOW_GAP_PX);
    expect(wide.right - fit.cut - wide.left).toBeGreaterThanOrEqual(FALLBACK_MIN_ROOM_PX);
  });

  it("shows at exactly the minimum room", () => {
    const winLeft = box.left + FALLBACK_MIN_ROOM_PX + FALLBACK_WINDOW_GAP_PX;
    expect(heroFallbackFit(box, winLeft)).toEqual({ show: true, cut: box.right - box.left - FALLBACK_MIN_ROOM_PX });
  });

  it("treats a non-finite measure as no window (never hides on bad input)", () => {
    expect(heroFallbackFit(box, Number.NaN)).toEqual({ show: true, cut: 0 });
  });

  it("the minimum room is a lattice that reads as one, not a sliver", () => {
    expect(FALLBACK_MIN_ROOM_PX).toBeGreaterThanOrEqual(240);
    expect(FALLBACK_WINDOW_GAP_PX).toBeGreaterThanOrEqual(16);
  });
});

describe("hero.css: the starter's 'Ask:' roll never shows two legible questions", () => {
  const css = readFileSync(fileURLToPath(new URL("../app/hero.css", import.meta.url)), "utf8");
  const block = (head: string) => {
    const at = css.indexOf(head);
    expect(at, head).toBeGreaterThan(-1);
    // Up to the block's closing brace at its own indent (keyframes nest).
    const end = css.indexOf("\n  }", at);
    return css.slice(at, end);
  };
  const rule = (selector: string) => block(`${selector} {`);
  const percent = (s: string) => Number(s.replace("%", ""));

  it("the outgoing line is fully faded within the first fifth of the roll", () => {
    const out = block("@keyframes live-roll-out");
    // The stop where opacity first reaches 0.
    const stops = [...out.matchAll(/(from|to|\d+(?:\.\d+)?%)\s*\{([^}]*)\}/g)].map((m) => ({
      at: m[1] === "from" ? 0 : m[1] === "to" ? 100 : percent(m[1]),
      body: m[2],
    }));
    const zero = stops.find((stop) => /opacity:\s*0\s*;/.test(stop.body));
    expect(zero, "a stop with opacity: 0").toBeDefined();
    expect(zero!.at).toBeGreaterThan(0);
    expect(zero!.at).toBeLessThanOrEqual(20);
    // It stays faded (and visible to the animation) to the end.
    expect(stops.at(-1)!.body).toMatch(/opacity:\s*0\s*;/);
  });

  it("both lines travel together (same distance, same duration and easing), so they never overlap", () => {
    const travel = (s: string) => s.match(/translate:\s*0\s*calc\(([^;]*)\);/)?.[1].replace(/-1 \*\s*/, "");
    expect(travel(block("@keyframes live-roll-in"))).toBe("var(--lines) * var(--live-lh)");
    expect(travel(block("@keyframes live-roll-out"))).toBe("var(--lines) * var(--live-lh)");
    const timing = (s: string) => s.match(/animation:\s*live-roll-\w+\s+([^;]*?)(?:\s+both)?;/)?.[1];
    const inT = timing(rule('.hero-live-text[data-roll="in"]'));
    expect(inT).toBeDefined();
    expect(timing(rule('.hero-live-text[data-roll="out"]'))).toBe(inT);
  });

  it("the outgoing line is hidden unless its animation runs, and both are clipped to the starter", () => {
    expect(rule('.hero-live-text[data-roll="out"]')).toMatch(/visibility:\s*hidden/);
    expect(rule(".hero-live-roll")).toMatch(/overflow:\s*hidden/);
  });
});
