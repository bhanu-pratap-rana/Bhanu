import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio, mixOklab, parseHex } from "./contrast";

const css = readFileSync(fileURLToPath(new URL("../app/globals.css", import.meta.url)), "utf8");

/** The custom properties of the first block that opens with `selector {`. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in globals.css`);
  const end = css.indexOf("}", start);
  const block = css.slice(start, end);
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const themes = {
  dark: { t: tokens(":root"), muted: 7, accent: 7 },
  light: { t: tokens(':root[data-theme="light"]'), muted: 6, accent: 4.5 },
};

describe.each(Object.entries(themes))("%s palette", (_name, { t, muted, accent }) => {
  const ratio = (fg: string, bg: string) => contrastRatio(t[fg], t[bg]);

  it("defines every colour token as a hex value", () => {
    for (const name of [
      "--ground",
      "--surface",
      "--ink",
      "--muted",
      "--accent",
      "--on-accent",
      "--scene-body",
      "--scene-edge",
      "--scene-mist",
      "--scene-accent",
      "--scene-hot",
      "--scene-rim",
    ]) {
      expect(t[name], name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("ink is >= 12:1 on ground and surface", () => {
    expect(ratio("--ink", "--ground")).toBeGreaterThanOrEqual(12);
    expect(ratio("--ink", "--surface")).toBeGreaterThanOrEqual(12);
  });

  it(`muted is >= ${muted}:1 on ground and surface`, () => {
    expect(ratio("--muted", "--ground")).toBeGreaterThanOrEqual(muted);
    expect(ratio("--muted", "--surface")).toBeGreaterThanOrEqual(muted);
  });

  it(`accent is >= ${accent}:1 on ground`, () => {
    expect(ratio("--accent", "--ground")).toBeGreaterThanOrEqual(accent);
  });

  it("on-accent is >= 4.5:1 on accent", () => {
    expect(ratio("--on-accent", "--accent")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("mixOklab", () => {
  it("returns either end at 0 and 1, and is symmetric", () => {
    expect(mixOklab("#5b6cff", "#eef2ff", 1)).toBe("#5b6cff");
    expect(mixOklab("#5b6cff", "#eef2ff", 0)).toBe("#eef2ff");
    expect(mixOklab("#000000", "#ffffff", 0.5)).toBe(mixOklab("#ffffff", "#000000", 0.5));
  });

  it("mixes black and white to oklab's mid grey (L 0.5), not sRGB's", () => {
    // oklab L = 0.5 is about #636363; an sRGB average would be #808080.
    expect(mixOklab("#000000", "#ffffff", 0.5)).toBe("#636363");
  });
});

// The Devanagari half of the hero lockup (hero.css .lockup-deva):
// color-mix(in oklab, var(--ink) 62%, var(--scene-edge)). Large text, but it
// is the name, so hold it to the body-text bar in both themes.
describe.each(Object.entries(themes))("%s lockup Devanagari", (_name, { t }) => {
  it("is >= 4.5:1 on ground", () => {
    const deva = mixOklab(t["--ink"], t["--scene-edge"], 0.62);
    expect(contrastRatio(deva, t["--ground"])).toBeGreaterThanOrEqual(4.5);
  });

  it("matches the mix hero.css declares", () => {
    const hero = readFileSync(fileURLToPath(new URL("../app/hero.css", import.meta.url)), "utf8");
    const block = hero.slice(hero.indexOf(".lockup-deva {"), hero.indexOf("}", hero.indexOf(".lockup-deva {")));
    expect(block).toContain("color: color-mix(in oklab, var(--ink) 62%, var(--scene-edge));");
  });
});

// The night sky behind the page (globals.css --backdrop on body::before):
// radial glows, each its colour at some alpha in the centre fading linearly
// to transparent at a stop, laid over --ground. Muted text (statuses,
// attributions, stack lines) crosses them, so it must hold body-text
// contrast over the worst point of the stack, not only over --ground.
type Glow = { cx: number; cy: number; rx: number; ry: number; hex: string; alpha: number; stop: number };

/** The glows of a --backdrop value, top layer first. */
function parseBackdrop(value: string): Glow[] {
  const glows: Glow[] = [];
  const layer =
    /radial-gradient\(\s*([\d.]+)vw\s+([\d.]+)vh\s+at\s+([\d.]+)%\s+([\d.]+)%\s*,\s*(?:color-mix\(in srgb,\s*(#[0-9a-f]{6})\s+([\d.]+)%,\s*transparent\)|(#[0-9a-f]{6}))\s+0%\s*,\s*transparent\s+([\d.]+)%\s*\)/gi;
  for (const m of value.matchAll(layer)) {
    glows.push({
      rx: Number(m[1]),
      ry: Number(m[2]),
      cx: Number(m[3]),
      cy: Number(m[4]),
      hex: m[5] ?? m[7],
      alpha: m[6] === undefined ? 1 : Number(m[6]) / 100,
      stop: Number(m[8]) / 100,
    });
  }
  return glows;
}

/** Source-over in gamma sRGB, as browsers composite. */
function over(hex: string, alpha: number, under: string): string {
  const [a, b] = [parseHex(hex), parseHex(under)];
  return `#${a
    .map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** The backdrop's colour at (x vw, y vh), percentages of the viewport. */
function backdropAt(glows: Glow[], ground: string, x: number, y: number): string {
  let colour = ground;
  for (const glow of [...glows].reverse()) {
    const d = Math.hypot((x - glow.cx) / glow.rx, (y - glow.cy) / glow.ry);
    const alpha = glow.alpha * Math.max(0, 1 - d / glow.stop);
    if (alpha > 0) colour = over(glow.hex, alpha, colour);
  }
  return colour;
}

/**
 * The lowest contrast `fg` has against the backdrop anywhere in the viewport
 * (1% grid). On night a glow is brighter than the ground, on day darker, so
 * the worst point is searched for, not assumed to be a glow's centre.
 */
function worstContrast(t: Record<string, string>, fg: string): number {
  const glows = parseBackdrop(t["--backdrop"]);
  let worst = contrastRatio(fg, t["--ground"]);
  for (let x = 0; x <= 100; x += 1) {
    for (let y = 0; y <= 100; y += 1) {
      worst = Math.min(worst, contrastRatio(fg, backdropAt(glows, t["--ground"], x, y)));
    }
  }
  return worst;
}

describe.each(Object.entries(themes))("%s backdrop glow", (_name, { t }) => {
  it("parses every glow of --backdrop", () => {
    const layers = t["--backdrop"].match(/radial-gradient\(/g)?.length ?? 0;
    expect(layers).toBeGreaterThan(0);
    expect(parseBackdrop(t["--backdrop"])).toHaveLength(layers);
  });

  it("composites a glow's centre over ground", () => {
    const [glow] = parseBackdrop(t["--backdrop"]);
    expect(backdropAt([glow], t["--ground"], glow.cx, glow.cy)).toBe(
      over(glow.hex, glow.alpha, t["--ground"]),
    );
  });

  it("finds a glow lower in contrast than the bare ground", () => {
    expect(worstContrast(t, t["--muted"])).toBeLessThan(contrastRatio(t["--muted"], t["--ground"]));
  });

  // Measured: night 6.17:1 (the teal glow at bottom left), day 5.98:1.
  it("muted is >= 4.5:1 over the worst point of the backdrop", () => {
    expect(worstContrast(t, t["--muted"])).toBeGreaterThanOrEqual(4.5);
  });

  it("ink is >= 7:1 over the worst point of the backdrop", () => {
    expect(worstContrast(t, t["--ink"])).toBeGreaterThanOrEqual(7);
  });
});

describe("global-error page", () => {
  // It replaces the root layout, so it cannot read the tokens: its inline
  // colours must be the night palette's values.
  const page = readFileSync(fileURLToPath(new URL("../app/global-error.tsx", import.meta.url)), "utf8");

  it("uses only the night palette's ground, ink and muted", () => {
    const t = themes.dark.t;
    const allowed = new Set(["--ground", "--ink", "--muted"].map((name) => t[name].toLowerCase()));
    const used = [...page.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase());
    expect(used.length).toBeGreaterThan(0);
    for (const hex of used) expect(allowed, hex).toContain(hex);
  });
});
