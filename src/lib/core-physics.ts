// Physics of the 3D memory core, as plain numbers so it is testable without a
// GPU: the intro rise, the springs that move each prism (magnetic lift under
// the pointer, ripples on events, the press dip), the ray tests behind hover,
// and the hover hysteresis. Nothing here allocates after construction: the
// renderer calls it every frame.

// ---- Intro: a closed-form underdamped rise ---------------------------------

export const INTRO_ZETA = 0.55;
export const INTRO_OMEGA = 10;
/** Each ring starts this much later than the one inside it, in seconds. */
export const INTRO_RING_DELAY = 0.09;
/** How deep a prism starts below the floor, in world units. */
export const INTRO_SINK = 3;
const INTRO_OMEGA_D = INTRO_OMEGA * Math.sqrt(1 - INTRO_ZETA * INTRO_ZETA);
const INTRO_DECAY = INTRO_ZETA * INTRO_OMEGA;

/**
 * Unit step response of an underdamped spring at time τ (seconds):
 * t(τ) = 1 - e^{-ζωτ}(cos ω_d τ + (ζω/ω_d) sin ω_d τ). About 12.6 % overshoot,
 * within 2 % of 1 after about 0.75 s. A function of time, not an integration,
 * so it is deterministic and frame-rate independent.
 */
export function introStep(tau: number): number {
  if (tau <= 0) return 0;
  const e = Math.exp(-INTRO_DECAY * tau);
  return 1 - e * (Math.cos(INTRO_OMEGA_D * tau) + (INTRO_DECAY / INTRO_OMEGA_D) * Math.sin(INTRO_OMEGA_D * tau));
}

/** Rise of one ring `elapsed` seconds after the intro started; 1 when still. */
export function introAt(elapsed: number, ring: number, still: boolean): number {
  if (still) return 1;
  return introStep(elapsed - ring * INTRO_RING_DELAY);
}

/**
 * Seconds until every ring up to `maxRing` is within `tol` of 1 for good
 * (the envelope e^{-ζωτ}/√(1-ζ²) bounds the error).
 */
export function introSettleTime(maxRing: number, tol = 1e-3): number {
  const envelope = 1 / Math.sqrt(1 - INTRO_ZETA * INTRO_ZETA);
  return maxRing * INTRO_RING_DELAY + Math.log(envelope / tol) / INTRO_DECAY;
}

/**
 * Width factor (0..1). The overshoot never reaches the width: neighbouring
 * prisms are only 0.173 units apart, so a wider prism would cut into them.
 */
export function introWidth(t: number): number {
  return Math.min(1, Math.max(0, t));
}

/** How far below the floor a prism sits (<= 0): it never lifts off the floor. */
export function introSink(t: number): number {
  return INTRO_SINK * (introWidth(t) - 1);
}

// ---- Springs -----------------------------------------------------------------

export type SpringParams = { k: number; c: number };

/** Magnetic lift: critically damped (c = 2√k), so it never overshoots. */
export const LIFT_SPRING: SpringParams = { k: 120, c: 2 * Math.sqrt(120) };
/** Ripples: ζ ≈ 0.35, a few visible bounces. */
export const RIPPLE_SPRING: SpringParams = { k: 90, c: 6.6 };
/** Press: a quick dip (peak at ~90 ms) and a springy return. */
export const PRESS_SPRING: SpringParams = { k: 200, c: 12.7 };

export const LIFT_RADIUS = 2.2;
export const LIFT_MAX = 0.18;
/** Re-aim the lift only when the hit moved this far, in world units… */
export const AIM_MOVE = 0.35;
/** …or this long has passed, in seconds. */
export const AIM_INTERVAL = 0.12;

export const RIPPLE_SPEED = 7; // world units per second
/** Distance at which a ripple's amplitude has fallen to 1/e. */
export const RIPPLE_LENGTH = 3.5;
/** A ripple stops travelling past this distance (the cluster is ~10.4 across). */
export const RIPPLE_REACH = 11;
export const CLICK_RIPPLE_AMP = 0.3;
export const ANSWER_RIPPLE_AMP = 0.2;
export const PRESS_DEPTH = 0.4;

/** Below this |x - target| + |v| a spring sleeps: snapped and not moving. */
export const SPRING_SLEEP = 1e-3;
/** Longest integration step; longer frames are split. */
const MAX_SUBSTEP = 1 / 120;
const RIPPLE_SLOTS = 8;

/**
 * Semi-implicit (symplectic) Euler for a set of independent damped springs,
 * in place. `target` null means rest at 0. Frames longer than 1/120 s are
 * sub-stepped, so a 50 ms frame stays stable. Springs that come within
 * SPRING_SLEEP of rest are snapped onto it. Returns whether any still moves.
 */
export function stepSprings(
  x: Float32Array,
  v: Float32Array,
  target: Float32Array | null,
  k: number,
  c: number,
  dt: number,
): boolean {
  const n = x.length;
  let moving = false;
  for (let i = 0; i < n; i++) {
    const goal = target ? target[i] : 0;
    let xi = x[i];
    let vi = v[i];
    if (Math.abs(xi - goal) + Math.abs(vi) < SPRING_SLEEP) {
      x[i] = goal;
      v[i] = 0;
      continue;
    }
    if (dt > 0) {
      const steps = Math.ceil(dt / MAX_SUBSTEP);
      const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        vi += (-k * (xi - goal) - c * vi) * h;
        xi += vi * h;
      }
    }
    if (Math.abs(xi - goal) + Math.abs(vi) < SPRING_SLEEP) {
      x[i] = goal;
      v[i] = 0;
    } else {
      x[i] = xi;
      v[i] = vi;
      moving = true;
    }
  }
  return moving;
}

/** The starting velocity that gives a spring at rest a first peak of `amp`. */
export function impulseForPeak(amp: number, k: number, c: number): number {
  const w0 = Math.sqrt(k);
  const zeta = c / (2 * w0);
  if (zeta >= 1) return amp * w0 * Math.E; // critically damped: x = v t e^{-ωt}
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  const tp = Math.atan2(wd, zeta * w0) / wd;
  const perUnit = (Math.exp(-zeta * w0 * tp) * Math.sin(wd * tp)) / wd;
  return amp / perUnit;
}

/** Ripple amplitude at distance `d` from its source: 1 at the source. */
export function rippleFalloff(d: number): number {
  return Math.exp(-Math.max(0, d) / RIPPLE_LENGTH);
}

/** Magnetic lift at distance `d` from the pointer's hit: 1 there, 0 from LIFT_RADIUS. */
export function liftWeight(d: number): number {
  const s = Math.min(1, Math.max(0, d / LIFT_RADIUS));
  return 1 - s * s * (3 - 2 * s);
}

/**
 * Per-prism springs of the core. `offset` holds the summed height offset
 * (world units) after each `step`. All state lives in typed arrays allocated
 * once.
 */
export class CorePhysics {
  readonly offset: Float32Array;
  private readonly xs: Float32Array;
  private readonly zs: Float32Array;
  private readonly liftX: Float32Array;
  private readonly liftV: Float32Array;
  private readonly liftT: Float32Array;
  private readonly rippleX: Float32Array;
  private readonly rippleV: Float32Array;
  private readonly pressX: Float32Array;
  private readonly pressV: Float32Array;
  // Ripple sources: a small ring of slots, reused oldest first.
  private readonly srcX = new Float64Array(RIPPLE_SLOTS);
  private readonly srcZ = new Float64Array(RIPPLE_SLOTS);
  private readonly srcAge = new Float64Array(RIPPLE_SLOTS).fill(-1);
  private readonly srcImpulse = new Float64Array(RIPPLE_SLOTS);
  private readonly srcSkip = new Int32Array(RIPPLE_SLOTS).fill(-1);
  private aimX = 0;
  private aimZ = 0;
  private aimHover = -1;
  private aimAt = -Infinity;
  private aimed = false;
  private still = false;

  constructor(xs: ArrayLike<number>, zs: ArrayLike<number>) {
    const n = xs.length;
    this.xs = Float32Array.from(xs);
    this.zs = Float32Array.from(zs);
    this.offset = new Float32Array(n);
    this.liftX = new Float32Array(n);
    this.liftV = new Float32Array(n);
    this.liftT = new Float32Array(n);
    this.rippleX = new Float32Array(n);
    this.rippleV = new Float32Array(n);
    this.pressX = new Float32Array(n);
    this.pressV = new Float32Array(n);
  }

  get count(): number {
    return this.xs.length;
  }

  /** A ripple travelling out from prism `from`; `skip` gets no impulse. */
  ripple(from: number, amp: number, skip = -1): void {
    if (this.still || !(from >= 0 && from < this.count) || !(amp > 0)) return;
    let slot = 0;
    for (let s = 0; s < RIPPLE_SLOTS; s++) {
      if (this.srcAge[s] < 0) {
        slot = s;
        break;
      }
      if (this.srcAge[s] > this.srcAge[slot]) slot = s;
    }
    this.srcX[slot] = this.xs[from];
    this.srcZ[slot] = this.zs[from];
    this.srcAge[slot] = 0;
    this.srcImpulse[slot] = impulseForPeak(amp, RIPPLE_SPRING.k, RIPPLE_SPRING.c);
    this.srcSkip[slot] = skip;
  }

  /** The clicked prism dips about 0.4 and springs back; the click ripples outward. */
  press(index: number): void {
    if (this.still || !(index >= 0 && index < this.count)) return;
    this.pressV[index] = impulseForPeak(-PRESS_DEPTH, PRESS_SPRING.k, PRESS_SPRING.c);
    this.ripple(index, CLICK_RIPPLE_AMP, index);
  }

  /**
   * The pointer's hit on the core (world x, z), the hovered prism (excluded
   * from the lift) and the time in seconds. Re-aims only when the hit moved
   * more than AIM_MOVE, AIM_INTERVAL passed, or the hover changed. Returns
   * whether it re-aimed.
   */
  aim(x: number, z: number, hovered: number, now: number): boolean {
    if (this.still) return false;
    const moved = Math.hypot(x - this.aimX, z - this.aimZ);
    if (this.aimed && hovered === this.aimHover && moved <= AIM_MOVE && now - this.aimAt < AIM_INTERVAL) {
      return false;
    }
    this.aimed = true;
    this.aimX = x;
    this.aimZ = z;
    this.aimHover = hovered;
    this.aimAt = now;
    for (let i = 0; i < this.count; i++) {
      const d = Math.hypot(this.xs[i] - x, this.zs[i] - z);
      this.liftT[i] = i === hovered ? 0 : LIFT_MAX * liftWeight(d);
    }
    return true;
  }

  /** The pointer left the core: the lift settles back to 0. */
  release(): void {
    if (!this.aimed) return;
    this.aimed = false;
    this.liftT.fill(0);
  }

  /** Advance `dt` seconds. With `still`, everything snaps to rest. Returns whether anything moves. */
  step(dt: number, still: boolean): boolean {
    this.still = still;
    if (still) {
      this.reset();
      return false;
    }
    const n = this.count;
    let moving = false;
    for (let s = 0; s < RIPPLE_SLOTS; s++) {
      const prev = this.srcAge[s];
      if (prev < 0) continue;
      if (prev * RIPPLE_SPEED > RIPPLE_REACH) {
        this.srcAge[s] = -1;
        continue;
      }
      const age = prev + dt;
      this.srcAge[s] = age;
      moving = true;
      for (let i = 0; i < n; i++) {
        if (i === this.srcSkip[s]) continue;
        const d = Math.hypot(this.xs[i] - this.srcX[s], this.zs[i] - this.srcZ[s]);
        const arrival = d / RIPPLE_SPEED;
        if (arrival >= prev && arrival < age) this.rippleV[i] += this.srcImpulse[s] * rippleFalloff(d);
      }
    }
    const lift = stepSprings(this.liftX, this.liftV, this.liftT, LIFT_SPRING.k, LIFT_SPRING.c, dt);
    const ripple = stepSprings(this.rippleX, this.rippleV, null, RIPPLE_SPRING.k, RIPPLE_SPRING.c, dt);
    const press = stepSprings(this.pressX, this.pressV, null, PRESS_SPRING.k, PRESS_SPRING.c, dt);
    for (let i = 0; i < n; i++) this.offset[i] = this.liftX[i] + this.rippleX[i] + this.pressX[i];
    return moving || lift || ripple || press;
  }

  private reset(): void {
    // Called every frame while still: no temporary arrays.
    this.offset.fill(0);
    this.liftX.fill(0);
    this.liftV.fill(0);
    this.liftT.fill(0);
    this.rippleX.fill(0);
    this.rippleV.fill(0);
    this.pressX.fill(0);
    this.pressV.fill(0);
    this.srcAge.fill(-1);
    this.aimed = false;
    this.aimHover = -1;
    this.aimAt = -Infinity;
  }
}

// ---- Ray tests ---------------------------------------------------------------

// Flat-top hexagon (corners on the x axis): the three face normals in xz.
const HEX_NX = [0, 0.8660254037844386, 0.8660254037844386];
const HEX_NZ = [1, 0.5, -0.5];

/**
 * Distance along a ray (origin o, direction d) to a vertical flat-top
 * hexagonal prism centred on (cx, cz) with the given apothem (centre to flat
 * side), spanning y0..y1. Infinity when it misses or lies behind the origin.
 */
export function rayHexPrism(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cz: number,
  apothem: number,
  y0: number,
  y1: number,
): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  // Vertical slab.
  if (Math.abs(dy) < 1e-12) {
    if (oy < y0 || oy > y1) return Infinity;
  } else {
    const a = (y0 - oy) / dy;
    const b = (y1 - oy) / dy;
    tmin = Math.min(a, b);
    tmax = Math.max(a, b);
  }
  // Three slabs, one per pair of opposite sides.
  for (let f = 0; f < 3; f++) {
    const s = HEX_NX[f] * (ox - cx) + HEX_NZ[f] * (oz - cz);
    const ds = HEX_NX[f] * dx + HEX_NZ[f] * dz;
    if (Math.abs(ds) < 1e-12) {
      if (Math.abs(s) > apothem) return Infinity;
      continue;
    }
    const a = (-apothem - s) / ds;
    const b = (apothem - s) / ds;
    tmin = Math.max(tmin, Math.min(a, b));
    tmax = Math.min(tmax, Math.max(a, b));
    if (tmin > tmax) return Infinity;
  }
  if (tmax < 0) return Infinity;
  return Math.max(0, tmin);
}

/** Distance along a ray to the horizontal plane at height `y`; Infinity if never ahead. */
export function rayPlaneY(oy: number, dy: number, y: number): number {
  if (Math.abs(dy) < 1e-12) return Infinity;
  const t = (y - oy) / dy;
  return t > 0 ? t : Infinity;
}

// ---- Hover hysteresis ----------------------------------------------------------

/** A different prism must stay in front this long before the hover switches to it. */
export const HOVER_SWITCH_MS = 80;
/** After this long without a pick, the old hover is forgotten. */
export const HOVER_STALE_MS = 250;

export type HoverLatch = { current: number; candidate: number; since: number; lastAt: number };

export function createHoverLatch(): HoverLatch {
  return { current: -1, candidate: -1, since: 0, lastAt: -Infinity };
}

/**
 * The hovered prism, with hysteresis, so heights moving under a still cursor
 * do not flip the hover between neighbours. `firstHit` is the nearest prism
 * on the ray (-1 for none); `hitsCurrent` says whether the ray still passes
 * through the hovered one (maybe behind another). Keeps the hovered prism
 * while the ray still hits it; switches only once a different prism has
 * stayed in front for HOVER_SWITCH_MS. Mutates `latch`; times in ms.
 */
export function resolveHover(latch: HoverLatch, firstHit: number, hitsCurrent: boolean, now: number): number {
  if (now - latch.lastAt > HOVER_STALE_MS) {
    latch.current = -1;
    latch.candidate = -1;
  }
  latch.lastAt = now;
  if (firstHit === latch.current) {
    latch.candidate = -1;
  } else if (firstHit < 0 || latch.current < 0 || !hitsCurrent) {
    latch.current = firstHit;
    latch.candidate = -1;
  } else if (latch.candidate !== firstHit) {
    latch.candidate = firstHit;
    latch.since = now;
  } else if (now - latch.since >= HOVER_SWITCH_MS) {
    latch.current = firstHit;
    latch.candidate = -1;
  }
  return latch.current;
}
