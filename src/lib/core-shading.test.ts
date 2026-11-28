import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXIT_GLOW } from "./core-stage";
import {
  PRISM_SHADE_GLSL,
  SHADE,
  type ShadeColors,
  type ShadeGeometry,
  type ShadeState,
  hexToLinear,
  hsv,
  linearToSrgb,
  shadePrism,
  warmPath,
  warmth,
  withHalo,
} from "./core-shading";
import { approach } from "./scene-state";

// The real tokens, so the test guards what the page ships.
const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in globals.css`);
  const block = css.slice(start, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function sceneColors(t: Record<string, string>): ShadeColors {
  return {
    body: hexToLinear(t["--scene-body"]),
    edge: hexToLinear(t["--scene-edge"]),
    mist: hexToLinear(t["--scene-mist"]),
    accent: hexToLinear(t["--scene-accent"]),
    hot: hexToLinear(t["--scene-hot"]),
    rim: hexToLinear(t["--scene-rim"]),
    add: Number(t["--scene-add"]),
  };
}

const themes = {
  dark: sceneColors(tokens(":root")),
  light: sceneColors(tokens(':root[data-theme="light"]')),
};

// Geometry as the camera sees it at its resting elevation (0.62 rad): the
// top faces it at ~35 degrees (fresnel ~0.11), lit by the key light (~0.8).
const TOP = { top: 1, side: 0, y: 1, fres: 0.114, lambert: 0.8, edge: 0 };
const SIDE = { top: 0, side: 1, d: 1, fres: 0.03, lambert: 0.35, edge: 0 };

const litCases: Record<string, ShadeGeometry> = {
  "top centre": { ...TOP, d: 0 },
  "top middle": { ...TOP, d: 0.5 },
  "top edge": { ...TOP, d: 0.8 },
  "lit rim": { ...TOP, d: 0.95, edge: 1 },
  "side mid": { ...SIDE, y: 0.5 },
  "side in shadow": { ...SIDE, y: 0.5, lambert: 0, fres: 0.27 },
  "side foot": { ...SIDE, y: 0.1 },
  "side top rim": { ...SIDE, y: 1, edge: 1 },
  corner: { ...SIDE, y: 0.5, edge: 0.6 },
};

/** Every steady glow the core shows (scene-state's levels, pulled, cited). */
const GLOWS = [0.28, 0.45, 0.62, 0.8, 1];

const state = (s: Partial<ShadeState>): ShadeState => ({ glow: 0, glowScale: 1, sect: 0, hover: 0, dim: 1, ...s });
const display = (c: ShadeColors, g: ShadeGeometry, s: Partial<ShadeState>) =>
  linearToSrgb(shadePrism(c, g, state(s)));

describe.each(Object.entries(themes))("%s theme: a lit prism", (_name, colors) => {
  describe.each(Object.entries(litCases))("%s", (_case, geo) => {
    it.each(GLOWS)("is amber, saturated and never clipped at glow %s", (glow) => {
      for (const s of [{ glow }, { glow, hover: 1 }, { glow, sect: 1 }, { glow, dim: 0.3 }]) {
        const px = display(colors, geo, s);
        const { h, s: sat } = hsv(px);
        expect(h, JSON.stringify(s)).toBeGreaterThanOrEqual(25);
        expect(h, JSON.stringify(s)).toBeLessThanOrEqual(50);
        expect(sat, JSON.stringify(s)).toBeGreaterThanOrEqual(0.6);
        for (const ch of px) expect(ch, JSON.stringify(s)).toBeLessThan(0.995);
      }
    });

    // The hero exit dims a lit note's light (presence glow down to
    // EXIT_GLOW) and the core settles (dim 0.65): it must stay amber, only
    // darker. Hue comes from the note's own glow, never the dimmed one.
    it.each(GLOWS)("stays amber while the hero exit dims glow %s", (glow) => {
      for (const glowScale of [EXIT_GLOW, 0.7]) {
        for (const dim of [1, 0.65]) {
          const s = { glow, glowScale, dim };
          const px = display(colors, geo, s);
          const { h, s: sat } = hsv(px);
          expect(h, JSON.stringify(s)).toBeGreaterThanOrEqual(25);
          expect(h, JSON.stringify(s)).toBeLessThanOrEqual(50);
          expect(sat, JSON.stringify(s)).toBeGreaterThanOrEqual(0.6);
        }
      }
    });

    // A note switching off eases its glow from a level to 0 (every demo
    // step), passing every value between: it fades through deep amber and
    // deep indigo (the V4 block below), never through pink, mauve or purple.
    it("never turns pink or purple while its glow fades out", () => {
      for (let i = 1; i <= 64; i++) {
        const glow = i * 0.005;
        for (const glowScale of [1, EXIT_GLOW]) {
          for (const dim of [1, 0.65]) {
            const s = { glow, glowScale, dim };
            const { h, s: sat } = hsv(display(colors, geo, s));
            if (h >= 280 && h <= 360) expect(sat, JSON.stringify({ ...s, h })).toBeLessThan(0.2);
          }
        }
      }
    });
  });

  it("runs hot (pale gold) at the centre, marigold in the middle, saffron at the edge", () => {
    const hue = (d: number) => hsv(display(colors, { ...TOP, d }, { glow: 1 })).h;
    expect(hue(0)).toBeGreaterThan(hue(0.5));
    expect(hue(0.5)).toBeGreaterThan(hue(0.95));
    // The centre is the brightest and palest part of the top.
    const centre = display(colors, { ...TOP, d: 0 }, { glow: 1 });
    const edge = display(colors, { ...TOP, d: 0.8 }, { glow: 1 });
    expect(centre[1]).toBeGreaterThan(edge[1]);
    expect(Math.min(...centre)).toBeGreaterThan(Math.min(...edge));
  });

  it("is the brightest thing in the core", () => {
    const litTop = hsv(display(colors, { ...TOP, d: 0 }, { glow: 1 })).v;
    const unlitTop = hsv(display(colors, { ...TOP, d: 0 }, {})).v;
    if (colors.add) expect(litTop).toBeGreaterThan(unlitTop);
    else expect(litTop).toBeGreaterThan(0.9);
  });
});

describe.each(Object.entries(themes))("%s theme: an unlit prism", (_name, colors) => {
  it("keeps electric-indigo edges", () => {
    for (const geo of [litCases["lit rim"], litCases["side top rim"], litCases.corner]) {
      const { h } = hsv(display(colors, geo, {}));
      expect(h).toBeGreaterThanOrEqual(220);
      expect(h).toBeLessThanOrEqual(250);
    }
  });

  it("has an indigo top", () => {
    const { h } = hsv(display(colors, { ...TOP, d: 0 }, {}));
    expect(h).toBeGreaterThanOrEqual(220);
    expect(h).toBeLessThanOrEqual(250);
  });

  it("turns its edge cyan on hover", () => {
    const { h } = hsv(display(colors, litCases["lit rim"], { hover: 1 }));
    expect(h).toBeGreaterThanOrEqual(180);
    expect(h).toBeLessThanOrEqual(205);
  });
});

describe("the halo over a lit top (dark ground)", () => {
  it.each(GLOWS)("keeps the centre gold, not white, at glow %s", (glow) => {
    const c = themes.dark;
    const px = withHalo(display(c, { ...TOP, d: 0 }, { glow }), c.rim, glow);
    const { h, s } = hsv(px);
    expect(h).toBeGreaterThanOrEqual(25);
    expect(h).toBeLessThanOrEqual(50);
    expect(s).toBeGreaterThanOrEqual(0.6);
  });
});

describe("the shader source", () => {
  it("is built from the same constants the mirror uses", () => {
    for (const [name, value] of Object.entries(SHADE)) {
      if (name === "HALO_ALPHA") continue; // a uniform, set by the renderer
      expect(PRISM_SHADE_GLSL, name).toContain(Number.isInteger(value) ? value.toFixed(1) : String(value));
    }
    expect(PRISM_SHADE_GLSL).not.toMatch(/\$\{/);
  });

  it("takes the hue from the undimmed glow and dims only the light", () => {
    expect(PRISM_SHADE_GLSL).toMatch(/smoothstep\([^;]*clamp\(glow, 0\.0, 1\.0\)\)/);
    expect(PRISM_SHADE_GLSL).toContain("glow * uGlowScale");
    expect(PRISM_SHADE_GLSL).toContain("warmPath(uBody, deepCold, warmBody, w)");
    expect(PRISM_SHADE_GLSL).not.toContain("crossWarm");
  });
});

// V4 (red-team critique): partially lit and fading prisms read as grey or
// muddy brown. A prism crossing between cold and warm now runs
// dim amber -> deep amber -> (valley) -> deep indigo -> indigo, saturated
// all the way. The one exception is the light theme's last stretch into the
// resting prism itself, which is pale lavender by design (--scene-body,
// HSV saturation ~0.12-0.29): there the prism is a light indigo tint, never
// greyer than at rest.
describe.each(Object.entries(themes))("%s theme: the cold-warm path (V4)", (name, colors) => {
  const MIN_SAT = 0.35;
  /** Below this glow a light-theme prism may be the pale tint of its resting colour. */
  const LIGHT_TINT_GLOW = 0.08;
  const WARM_HUE: [number, number] = [10, 55];
  const COOL_HUE: [number, number] = [180, 255];
  const inBand = (h: number, [lo, hi]: [number, number]) => h >= lo && h <= hi;

  /** Why this step fails, or null. (One expect per sweep: thousands of samples.) */
  function fault(geo: ShadeGeometry, s: ShadeState, label: string): string | null {
    const { h, s: sat, v } = hsv(linearToSrgb(shadePrism(colors, geo, s)));
    const why = () => JSON.stringify({ label, ...s, h: Math.round(h), sat: +sat.toFixed(3), v: +v.toFixed(3) });
    if (!inBand(h, WARM_HUE) && !inBand(h, COOL_HUE)) return why();
    let floor = MIN_SAT;
    if (name === "light" && s.glow < LIGHT_TINT_GLOW && inBand(h, COOL_HUE)) {
      const rest = hsv(linearToSrgb(shadePrism(colors, geo, { ...s, glow: 0 })));
      floor = Math.min(MIN_SAT, rest.s) - 1e-9;
    }
    return sat >= floor ? null : why();
  }

  const variants: Partial<ShadeState>[] = [
    {},
    { glowScale: EXIT_GLOW },
    { glowScale: 0.7, dim: 0.65 },
    { glowScale: EXIT_GLOW, dim: 0.65 },
    { hover: 1 },
    { sect: 1 },
  ];

  it.each(Object.entries(litCases))("%s: every glow from 0 to 0.3 (dense sweep)", (label, geo) => {
    const faults: string[] = [];
    for (let i = 0; i <= 600; i++) {
      const glow = i * 0.0005;
      for (const v of variants) {
        const f = fault(geo, state({ ...v, glow }), label);
        if (f) faults.push(f);
      }
    }
    expect(faults.slice(0, 5)).toEqual([]);
  });

  // The renderer eases glow at rate 6/s (core-renderer approach(..., 6, dt)):
  // walk every steady level out to dark and back in, frame by frame.
  it.each(Object.entries(litCases))("%s: fades out and in, frame by frame", (label, geo) => {
    const RATE = 6;
    const faults: string[] = [];
    for (const dt of [1 / 120, 1 / 60, 1 / 30]) {
      for (const level of GLOWS) {
        for (const [from, to] of [[level, 0], [0, level]]) {
          let glow = from;
          for (let t = 0; t < 2.5; t += dt) {
            glow = approach(glow, to, RATE, dt);
            for (const v of variants.slice(0, 4)) {
              const f = fault(geo, state({ ...v, glow }), `${label} ${from}->${to}`);
              if (f) faults.push(f);
            }
          }
        }
      }
    }
    expect(faults.slice(0, 5)).toEqual([]);
  });

  it("darkens through the valley: the hand-over is the darkest point of the path", () => {
    const geo = litCases["side mid"];
    const value = (glow: number) => hsv(display(colors, geo, { glow })).v;
    const valley = Math.min(value(0.1249), value(0.1251));
    for (const glow of [0, 0.03, 0.06, 0.2, 0.25, 0.28]) expect(value(glow)).toBeGreaterThan(valley);
  });

  it("hands over at the midpoint, cool below it and warm above it", () => {
    const geo = litCases["top middle"];
    expect(inBand(hsv(display(colors, geo, { glow: 0.12 })).h, COOL_HUE)).toBe(true);
    expect(inBand(hsv(display(colors, geo, { glow: 0.13 })).h, WARM_HUE)).toBe(true);
  });
});

describe("warmPath", () => {
  const cold = [0.1, 0.2, 0.9] as const;
  const deep = [0.01, 0.02, 0.1] as const;
  const warm = [0.9, 0.4, 0.05] as const;

  it("starts cold and ends warm, exactly", () => {
    expect(warmPath(cold, deep, warm, 0)).toEqual(cold);
    expect(warmPath(cold, deep, warm, 1)).toEqual(warm);
  });

  it("never mixes the two sides: each half is a scaled blend of its own colours", () => {
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const [r, , b] = warmPath(cold, deep, warm, t);
      if (t < 0.5) expect(b).toBeGreaterThan(r);
      else expect(r).toBeGreaterThan(b);
    }
  });

  it("is darkest at the hand-over", () => {
    const lum = (t: number) => warmPath(cold, deep, warm, t).reduce((a, x) => a + x, 0);
    const valley = Math.min(lum(0.4999), lum(0.5));
    for (const t of [0, 0.2, 0.4, 0.6, 0.8, 1]) expect(lum(t)).toBeGreaterThanOrEqual(valley - 1e-12);
    expect(warmth(SHADE.WARM_ONSET / 2)).toBeCloseTo(0.5, 9);
  });
});
