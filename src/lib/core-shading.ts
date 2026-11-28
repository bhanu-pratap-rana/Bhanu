// The memory core's prism colour, in one place: the GLSL the renderer
// compiles and a JS mirror of the same maths, so tests can check what a lit
// prism looks like (amber, never pink, never clipped to white) without a GPU.
// Both read the constants below; change one and both change.
//
// Colours are linear RGB, as three.js hands them to a shader (Color.set
// decodes sRGB); the renderer's <colorspace_fragment> encodes the result.

export type Rgb = readonly [number, number, number];

/** The theme's scene colours, linear RGB. `add` is 1 on dark grounds (light adds), 0 on light. */
export type ShadeColors = {
  body: Rgb;
  edge: Rgb;
  mist: Rgb;
  accent: Rgb;
  hot: Rgb;
  rim: Rgb;
  add: number;
};

/** Where on the prism a fragment is, as the renderer's main() works it out. */
export type ShadeGeometry = {
  /** 1 on the top face. */
  top: number;
  /** 1 on a side face. */
  side: number;
  /** 0 at the centre of the top hexagon, 1 on its edge. */
  d: number;
  /** Height up the side, 0 at the foot, 1 at the top. */
  y: number;
  fres: number;
  lambert: number;
  /** 0..1: how much this fragment is a drawn edge (the top's rim, a corner). */
  edge: number;
};

export type ShadeState = {
  /**
   * The note's own glow, undimmed: it alone decides how warm (amber) the
   * prism is, so dimming a lit note never shifts its hue.
   */
  glow: number;
  /**
   * How much of that glow's light shows (the core's presence glow: the hero
   * exit lowers it). Scales brightness only, never hue.
   */
  glowScale: number;
  sect: number;
  hover: number;
  dim: number;
};

/**
 * Tuning. A lit prism leaves the cool body behind entirely: its body and its
 * edge tint become a warm dark taken from the rim, so mixing warm light into
 * it stays amber. (Mixing marigold into indigo is what made it pink.)
 */
export const SHADE = {
  /** A note's own (undimmed) glow at which its prism is fully warm. Below the dimmest steady glow (0.28). */
  WARM_ONSET: 0.25,
  /** Lit body = rim x this on a dark ground: a deep amber-brown. */
  WARM_BODY_DARK: 0.16,
  /** Lit body = rim x this on a light ground: a lighter amber. */
  WARM_BODY_LIGHT: 0.42,
  /** Lit fresnel / top tint = rim x this. */
  WARM_TINT: 0.5,
  /** Where the top's gradient is pure accent: hot inside it, rim beyond. */
  MID_STOP: 0.5,
  /** How far the warm gradient replaces the shaded body at full glow. */
  WARM_MIX: 0.85,
  /** Light added on dark grounds (accent x glow x this). */
  ADD_LIGHT: 0.3,
  /** Warm light up the sides, at the top of a side. */
  SIDE_INNER: 0.45,
  /** A lit fragment's brightest channel stays at or under this (linear): hue kept, never white. */
  LIT_PEAK: 0.9,
  /** Halo over a lit top (dark grounds): rim x glow x this, added on screen. */
  HALO_ALPHA: 0.24,
  /**
   * The deep indigo a fading prism passes through: edge x this. Dark
   * grounds: about the body's own depth. Light grounds: the edge itself, a
   * saturated indigo (darkening the pale body would only make it grey).
   */
  DEEP_INDIGO_DARK: 0.07,
  DEEP_INDIGO_LIGHT: 0.85,
  /** The deep amber a fading prism passes through: its warm colour x this. */
  DEEP_AMBER: 0.55,
  /**
   * Light left at the valley, where deep amber hands over to deep indigo.
   * The hand-over is a step between two dark, saturated colours: any blend
   * of the two would be grey (they are near complements) or magenta.
   */
  VALLEY: 0.35,
} as const;

function glslFloat(n: number): string {
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

/**
 * The prism's shading, GLSL (warmPath and shadePrism). Expects the uniforms uBody, uEdge, uMist,
 * uAccent, uHot, uRim, uAdd, uDim and uGlowScale to be declared before it.
 * `glow` is the note's undimmed glow; uGlowScale dims its light only.
 */
export const PRISM_SHADE_GLSL = /* glsl */ `
  // Cold to warm along darker values, never through a neutral grey nor a
  // mix of the two (indigo plus marigold is magenta): the cold colour turns
  // deep indigo and darkens to the valley; there it steps to a dark amber,
  // which deepens back up to the warm colour. Both sides of the step are
  // dark and saturated, so the step reads as the prism dimming and coming
  // back warm. Fading out runs the same path backwards.
  vec3 warmPath(vec3 cold, vec3 deepCold, vec3 warm, float t) {
    float valley = ${glslFloat(SHADE.VALLEY)};
    if (t < 0.5) {
      float u = t * 2.0;
      vec3 c = mix(cold, deepCold, smoothstep(0.0, 0.6, u));
      return c * mix(1.0, valley, smoothstep(0.4, 1.0, u));
    }
    float u = t * 2.0 - 1.0;
    vec3 c = mix(warm * ${glslFloat(SHADE.DEEP_AMBER)}, warm, smoothstep(0.4, 1.0, u));
    return c * mix(valley, 1.0, smoothstep(0.0, 0.6, u));
  }

  vec3 shadePrism(float top, float side, float d, float y, float fres, float lambert,
                  float edge, float glow, float sect, float hover) {
    // Hue from the note's own glow, light from its glow as shown.
    float w = smoothstep(0.0, ${glslFloat(SHADE.WARM_ONSET)}, clamp(glow, 0.0, 1.0));
    float g = clamp(glow * uGlowScale, 0.0, 1.0);
    // 1 on the cold side of the path, 0 once it has crossed to warm.
    float cold = 1.0 - smoothstep(0.0, 0.5, w);
    vec3 warmBody = uRim * mix(${glslFloat(SHADE.WARM_BODY_LIGHT)}, ${glslFloat(SHADE.WARM_BODY_DARK)}, uAdd);
    vec3 warmTint = uRim * ${glslFloat(SHADE.WARM_TINT)};
    vec3 deepCold = uEdge * mix(${glslFloat(SHADE.DEEP_INDIGO_LIGHT)}, ${glslFloat(SHADE.DEEP_INDIGO_DARK)}, uAdd);
    vec3 body = warmPath(uBody, deepCold, warmBody, w);
    vec3 tint = warmPath(uEdge, deepCold, warmTint, w);

    vec3 col = body * (0.55 + 0.75 * lambert);
    col = mix(col, tint, fres * 0.4);
    col *= mix(1.0, mix(0.45, 1.0, y), side);
    col = mix(col, tint, top * 0.18);

    float lift = max(max(sect * 0.7, g), hover);
    vec3 edgeCol = mix(uEdge, uMist, max(sect, hover));
    edgeCol = warmPath(edgeCol, deepCold, uRim, w);
    col = mix(col, edgeCol, edge * (0.45 + 0.55 * lift));

    // Warm light from inside a note the copilot touched: on the top hot at
    // the centre, accent, rim at the edge; up the sides rim to accent.
    float mid = ${glslFloat(SHADE.MID_STOP)};
    vec3 warmTop = mix(mix(uHot, uAccent, smoothstep(0.0, mid, d)), uRim, smoothstep(mid, 1.0, d));
    vec3 warm = top * warmTop + side * mix(uRim, uAccent, y);
    // Only once the body has crossed to the warm side: light on indigo is pink.
    float inner = (top * (0.45 + 0.55 * (1.0 - d)) + side * ${glslFloat(SHADE.SIDE_INNER)} * y) * smoothstep(0.5, 1.0, w);
    col = mix(col, warm, clamp(g * inner, 0.0, 1.0) * ${glslFloat(SHADE.WARM_MIX)});
    col += uAccent * g * inner * ${glslFloat(SHADE.ADD_LIGHT)} * uAdd;
    col = mix(col, uMist, (sect * 0.08 + hover * 0.18) * top * cold);

    // As the core settles it dims, but what the copilot touched stays lit.
    col = mix(body * 0.6 + col * 0.4, col, mix(uDim, 1.0, g * 0.7));

    // A lit fragment is scaled, not clipped: its hue holds and it never
    // reaches white.
    float peak = max(col.r, max(col.g, col.b));
    col *= mix(1.0, min(1.0, ${glslFloat(SHADE.LIT_PEAK)} / max(peak, 1e-4)), w);
    return col;
  }
`;

// ---- JS mirror ---------------------------------------------------------------

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const mixN = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [mixN(a[0], b[0], t), mixN(a[1], b[1], t), mixN(a[2], b[2], t)];
const scale = (a: Rgb, k: number): Rgb => [a[0] * k, a[1] * k, a[2] * k];
const add = (a: Rgb, b: Rgb): Rgb => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** PRISM_SHADE_GLSL's warmPath: cold -> deep indigo -> valley | dark amber -> warm. */
export function warmPath(cold: Rgb, deepCold: Rgb, warm: Rgb, t: number): Rgb {
  if (t < 0.5) {
    const u = t * 2;
    const c = mix(cold, deepCold, smoothstep(0, 0.6, u));
    return scale(c, mixN(1, SHADE.VALLEY, smoothstep(0.4, 1, u)));
  }
  const u = t * 2 - 1;
  const c = mix(scale(warm, SHADE.DEEP_AMBER), warm, smoothstep(0.4, 1, u));
  return scale(c, mixN(SHADE.VALLEY, 1, smoothstep(0, 0.6, u)));
}

/** How warm (0..1) a note's own glow makes its prism: the path's t. */
export function warmth(glow: number): number {
  return smoothstep(0, SHADE.WARM_ONSET, clamp01(glow));
}

/** PRISM_SHADE_GLSL's shadePrism, line for line. Linear RGB in and out. */
export function shadePrism(c: ShadeColors, geo: ShadeGeometry, s: ShadeState): Rgb {
  const { top, side, d, y, fres, lambert, edge } = geo;
  const w = warmth(s.glow);
  const g = clamp01(s.glow * s.glowScale);
  const cold = 1 - smoothstep(0, 0.5, w);
  const warmBody = scale(c.rim, mixN(SHADE.WARM_BODY_LIGHT, SHADE.WARM_BODY_DARK, c.add));
  const warmTint = scale(c.rim, SHADE.WARM_TINT);
  const deepCold = scale(c.edge, mixN(SHADE.DEEP_INDIGO_LIGHT, SHADE.DEEP_INDIGO_DARK, c.add));
  const body = warmPath(c.body, deepCold, warmBody, w);
  const tint = warmPath(c.edge, deepCold, warmTint, w);

  let col = scale(body, 0.55 + 0.75 * lambert);
  col = mix(col, tint, fres * 0.4);
  col = scale(col, mixN(1, mixN(0.45, 1, y), side));
  col = mix(col, tint, top * 0.18);

  const lift = Math.max(Math.max(s.sect * 0.7, g), s.hover);
  let edgeCol = mix(c.edge, c.mist, Math.max(s.sect, s.hover));
  edgeCol = warmPath(edgeCol, deepCold, c.rim, w);
  col = mix(col, edgeCol, edge * (0.45 + 0.55 * lift));

  const mid = SHADE.MID_STOP;
  const warmTop = mix(mix(c.hot, c.accent, smoothstep(0, mid, d)), c.rim, smoothstep(mid, 1, d));
  const warm = add(scale(warmTop, top), scale(mix(c.rim, c.accent, y), side));
  const inner = (top * (0.45 + 0.55 * (1 - d)) + side * SHADE.SIDE_INNER * y) * smoothstep(0.5, 1, w);
  col = mix(col, warm, clamp01(g * inner) * SHADE.WARM_MIX);
  col = add(col, scale(c.accent, g * inner * SHADE.ADD_LIGHT * c.add));
  col = mix(col, c.mist, (s.sect * 0.08 + s.hover * 0.18) * top * cold);

  col = mix(add(scale(body, 0.6), scale(col, 0.4)), col, mixN(s.dim, 1, g * 0.7));

  const peak = Math.max(col[0], col[1], col[2]);
  return scale(col, mixN(1, Math.min(1, SHADE.LIT_PEAK / Math.max(peak, 1e-4)), w));
}

// ---- Colour helpers (three.js's sRGB transfer functions) -----------------------

export function hexToLinear(hex: string): Rgb {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  const dec = (v: number) => {
    const c = v / 255;
    return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
  };
  return [dec((n >> 16) & 255), dec((n >> 8) & 255), dec(n & 255)];
}

/** Linear to display sRGB, clamped as the framebuffer clamps it. */
export function linearToSrgb(rgb: Rgb): Rgb {
  const enc = (v: number) => {
    const c = Math.max(0, v);
    return clamp01(c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055);
  };
  return [enc(rgb[0]), enc(rgb[1]), enc(rgb[2])];
}

/**
 * The halo's light at its centre (just above a lit top), added on screen
 * over the prism's display colour as the renderer's blend adds it. Dark
 * grounds only.
 */
export function withHalo(display: Rgb, rim: Rgb, glow: number): Rgb {
  const h = linearToSrgb(rim);
  const k = SHADE.HALO_ALPHA * clamp01(glow);
  return [clamp01(display[0] + h[0] * k), clamp01(display[1] + h[1] * k), clamp01(display[2] + h[2] * k)];
}

/** Hue in degrees, HSV saturation (chroma / value) and value, of a display colour. */
export function hsv(rgb: Rgb): { h: number; s: number; v: number } {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const c = max - min;
  let h = 0;
  if (c > 0) {
    if (max === r) h = 60 * (((g - b) / c) % 6);
    else if (max === g) h = 60 * ((b - r) / c + 2);
    else h = 60 * ((r - g) / c + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : c / max, v: max };
}
