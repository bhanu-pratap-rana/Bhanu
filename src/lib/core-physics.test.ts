import { describe, expect, it } from "vitest";
import {
  CLICK_RIPPLE_AMP,
  CorePhysics,
  HOVER_SWITCH_MS,
  INTRO_RING_DELAY,
  LIFT_MAX,
  LIFT_RADIUS,
  PRESS_DEPTH,
  PRESS_SPRING,
  RIPPLE_SPEED,
  RIPPLE_SPRING,
  createHoverLatch,
  impulseForPeak,
  introAt,
  introSettleTime,
  introSink,
  introStep,
  introWidth,
  liftWeight,
  rayHexPrism,
  rayPlaneY,
  resolveHover,
  rippleFalloff,
  stepSprings,
} from "./core-physics";

const DTS = [1 / 120, 0.05];

/** A line of prisms on the x axis, `gap` apart, starting at the origin. */
function line(n: number, gap = Math.sqrt(3)) {
  const xs = Array.from({ length: n }, (_, i) => i * gap);
  const zs = Array.from({ length: n }, () => 0);
  return { xs, zs };
}

function run(physics: CorePhysics, seconds: number, dt: number, onStep?: () => void): boolean {
  let moving = true;
  for (let t = 0; t < seconds; t += dt) {
    moving = physics.step(dt, false);
    onStep?.();
  }
  return moving;
}

describe("intro: closed-form underdamped rise", () => {
  it("starts at 0, overshoots by about 12.6 % at most, and settles on 1", () => {
    expect(introStep(0)).toBe(0);
    expect(introStep(-1)).toBe(0);
    let peak = 0;
    for (let tau = 0; tau < 3; tau += 0.001) peak = Math.max(peak, introStep(tau));
    expect(peak).toBeGreaterThan(1.1);
    expect(peak).toBeLessThan(1.14);
    for (let tau = 0.8; tau < 3; tau += 0.01) expect(Math.abs(introStep(tau) - 1)).toBeLessThan(0.02);
  });

  it("never goes negative", () => {
    for (let tau = 0; tau < 3; tau += 0.001) expect(introStep(tau)).toBeGreaterThanOrEqual(0);
  });

  it("delays each ring by 90 ms, and the whole rise is done (within 2 %) by about 1.05 s", () => {
    expect(introAt(INTRO_RING_DELAY * 3, 3, false)).toBe(0);
    expect(introAt(0.1, 0, false)).toBeGreaterThan(introAt(0.1, 1, false));
    for (let ring = 0; ring <= 3; ring++) {
      expect(Math.abs(introAt(1.05, ring, false) - 1)).toBeLessThan(0.02);
    }
  });

  it("is exactly 1 when still", () => {
    expect(introAt(0, 3, true)).toBe(1);
    expect(introAt(0.2, 0, true)).toBe(1);
  });

  it("settles within the tolerance for every ring by introSettleTime", () => {
    const end = introSettleTime(3);
    expect(end).toBeGreaterThan(1.05);
    expect(end).toBeLessThan(2);
    for (let ring = 0; ring <= 3; ring++) {
      for (let t = end; t < end + 1; t += 0.01) expect(Math.abs(introAt(t, ring, false) - 1)).toBeLessThan(2e-3);
    }
  });

  it("never widens a prism past 1, so neighbours never cut into each other", () => {
    for (let tau = -0.5; tau < 3; tau += 0.001) {
      const w = introWidth(introStep(tau));
      expect(w).toBeLessThanOrEqual(1);
      expect(w).toBeGreaterThanOrEqual(0);
    }
  });

  it("never lifts a prism off the floor: the sink is at most 0", () => {
    for (let tau = 0; tau < 3; tau += 0.001) expect(introSink(introStep(tau))).toBeLessThanOrEqual(0);
    expect(introSink(0)).toBeLessThan(-2);
    expect(introSink(1)).toBe(0);
  });
});

describe("stepSprings (semi-implicit Euler)", () => {
  for (const dt of DTS) {
    it(`stays bounded and settles after an impulse at dt ${dt.toFixed(4)}`, () => {
      const x = new Float32Array(4);
      const v = new Float32Array([5, -5, 10, 0]);
      let maxAbs = 0;
      let moving = true;
      for (let t = 0; t < 4; t += dt) {
        moving = stepSprings(x, v, null, RIPPLE_SPRING.k, RIPPLE_SPRING.c, dt);
        for (const n of x) maxAbs = Math.max(maxAbs, Math.abs(n));
      }
      expect(maxAbs).toBeLessThan(1.5);
      expect(moving).toBe(false);
      expect(Array.from(x)).toEqual([0, 0, 0, 0]);
      expect(Array.from(v)).toEqual([0, 0, 0, 0]);
    });

    it(`tracks a target without overshoot when critically damped at dt ${dt.toFixed(4)}`, () => {
      const x = new Float32Array(1);
      const v = new Float32Array(1);
      const target = new Float32Array([LIFT_MAX]);
      let peak = 0;
      for (let t = 0; t < 2; t += dt) {
        stepSprings(x, v, target, 120, 2 * Math.sqrt(120), dt);
        peak = Math.max(peak, x[0]);
      }
      expect(peak).toBeLessThanOrEqual(LIFT_MAX + 1e-6);
      expect(x[0]).toBeCloseTo(LIFT_MAX, 6);
    });
  }

  it("reports a resting spring as not moving (the draw loop may skip)", () => {
    const x = new Float32Array(3);
    const v = new Float32Array(3);
    expect(stepSprings(x, v, null, 90, 6.6, 1 / 60)).toBe(false);
  });
});

describe("impulseForPeak", () => {
  for (const [name, spring, amp] of [
    ["ripple", RIPPLE_SPRING, CLICK_RIPPLE_AMP],
    ["press", PRESS_SPRING, -PRESS_DEPTH],
  ] as const) {
    it(`gives the ${name} spring a first peak of about ${amp}`, () => {
      const x = new Float32Array(1);
      const v = new Float32Array([impulseForPeak(amp, spring.k, spring.c)]);
      let peak = 0;
      for (let t = 0; t < 1; t += 1 / 240) {
        stepSprings(x, v, null, spring.k, spring.c, 1 / 240);
        if (Math.abs(x[0]) > Math.abs(peak)) peak = x[0];
      }
      expect(Math.sign(peak)).toBe(Math.sign(amp));
      expect(Math.abs(peak - amp)).toBeLessThan(Math.abs(amp) * 0.06);
    });
  }
});

describe("falloffs", () => {
  it("ripple amplitude is 1 at the source and falls with distance", () => {
    expect(rippleFalloff(0)).toBe(1);
    let prev = 1;
    for (let d = 0.5; d < 12; d += 0.5) {
      const f = rippleFalloff(d);
      expect(f).toBeLessThan(prev);
      expect(f).toBeGreaterThanOrEqual(0);
      prev = f;
    }
  });

  it("lift is full at the pointer, smooth, and zero from 2.2 units out", () => {
    expect(liftWeight(0)).toBe(1);
    expect(liftWeight(LIFT_RADIUS)).toBe(0);
    expect(liftWeight(5)).toBe(0);
    let prev = 1;
    for (let d = 0.1; d < LIFT_RADIUS; d += 0.1) {
      expect(liftWeight(d)).toBeLessThanOrEqual(prev);
      prev = liftWeight(d);
    }
  });
});

describe("CorePhysics", () => {
  it("is at rest from the start: offsets 0, not moving", () => {
    const { xs, zs } = line(5);
    const physics = new CorePhysics(xs, zs);
    expect(physics.step(1 / 60, false)).toBe(false);
    expect(Array.from(physics.offset)).toEqual([0, 0, 0, 0, 0]);
  });

  for (const dt of DTS) {
    it(`a ripple reaches each prism after distance / speed, stays bounded and settles (dt ${dt})`, () => {
      const { xs, zs } = line(5);
      const physics = new CorePhysics(xs, zs);
      physics.ripple(0, 0.3);
      const firstMove = new Array<number>(5).fill(-1);
      let t = 0;
      let maxAbs = 0;
      const moving = run(physics, 5, dt, () => {
        t += dt;
        for (let i = 0; i < 5; i++) {
          if (firstMove[i] < 0 && Math.abs(physics.offset[i]) > 1e-4) firstMove[i] = t;
          maxAbs = Math.max(maxAbs, Math.abs(physics.offset[i]));
        }
      });
      for (let i = 1; i < 5; i++) {
        const arrival = xs[i] / RIPPLE_SPEED;
        expect(firstMove[i]).toBeGreaterThan(arrival - 1e-6);
        expect(firstMove[i]).toBeLessThan(arrival + 2 * dt + 1e-6);
        expect(firstMove[i]).toBeGreaterThan(firstMove[i - 1]);
      }
      expect(maxAbs).toBeLessThan(0.35);
      expect(moving).toBe(false);
      expect(Array.from(physics.offset).every((n) => n === 0)).toBe(true);
    });
  }

  it("a ripple's peak falls off with distance from the source", () => {
    const { xs, zs } = line(4);
    const physics = new CorePhysics(xs, zs);
    physics.ripple(0, 0.2);
    const peaks = [0, 0, 0, 0];
    run(physics, 3, 1 / 120, () => {
      for (let i = 0; i < 4; i++) peaks[i] = Math.max(peaks[i], physics.offset[i]);
    });
    expect(peaks[0]).toBeGreaterThan(0.18);
    expect(peaks[0]).toBeLessThan(0.22);
    for (let i = 1; i < 4; i++) expect(peaks[i]).toBeLessThan(peaks[i - 1]);
  });

  it("press dips the prism by about 0.4, springs back, and ripples the others", () => {
    const { xs, zs } = line(3);
    const physics = new CorePhysics(xs, zs);
    physics.press(0);
    let low = 0;
    let neighbourHigh = 0;
    const moving = run(physics, 3, 1 / 120, () => {
      low = Math.min(low, physics.offset[0]);
      neighbourHigh = Math.max(neighbourHigh, physics.offset[1]);
    });
    expect(low).toBeLessThan(-0.36);
    expect(low).toBeGreaterThan(-0.44);
    // The pressed prism does not also bounce up with its own ripple.
    expect(neighbourHigh).toBeGreaterThan(0.05);
    expect(moving).toBe(false);
    expect(physics.offset[0]).toBe(0);
  });

  it("the press dip peaks before the 260 ms double-click delay", () => {
    const { xs, zs } = line(1);
    const physics = new CorePhysics(xs, zs);
    physics.press(0);
    let low = 0;
    let lowAt = 0;
    let t = 0;
    run(physics, 0.5, 1 / 120, () => {
      t += 1 / 120;
      if (physics.offset[0] < low) {
        low = physics.offset[0];
        lowAt = t;
      }
    });
    expect(lowAt).toBeLessThan(0.15);
  });

  it("magnetic lift raises nearby prisms up to +0.18, excludes the hovered one, and never overshoots", () => {
    const { xs, zs } = line(4);
    const physics = new CorePhysics(xs, zs);
    physics.aim(0, 0, 0, 0);
    let peak1 = 0;
    run(physics, 2, 1 / 60, () => {
      peak1 = Math.max(peak1, physics.offset[1]);
    });
    expect(physics.offset[0]).toBe(0); // hovered
    expect(physics.offset[1]).toBeGreaterThan(0);
    expect(physics.offset[1]).toBeLessThan(LIFT_MAX);
    expect(peak1).toBeLessThanOrEqual(physics.offset[1] + 1e-6);
    expect(physics.offset[2]).toBe(0); // 3.46 units away
    // With no hover, the prism under the pointer gets the full lift.
    physics.aim(0, 0, -1, 1);
    run(physics, 2, 1 / 60);
    expect(physics.offset[0]).toBeCloseTo(LIFT_MAX, 5);
  });

  it("re-aims only when the hit moved more than 0.35 units or 120 ms passed", () => {
    const { xs, zs } = line(3);
    const physics = new CorePhysics(xs, zs);
    expect(physics.aim(0, 0, -1, 0)).toBe(true);
    expect(physics.aim(0.2, 0, -1, 0.05)).toBe(false);
    expect(physics.aim(0.5, 0, -1, 0.06)).toBe(true);
    expect(physics.aim(0.5, 0, -1, 0.1)).toBe(false);
    expect(physics.aim(0.5, 0, -1, 0.19)).toBe(true);
    // A change of hovered prism always re-aims.
    expect(physics.aim(0.5, 0, 1, 0.2)).toBe(true);
  });

  it("release lowers the lift back to 0 and then rests", () => {
    const { xs, zs } = line(2);
    const physics = new CorePhysics(xs, zs);
    physics.aim(0, 0, -1, 0);
    run(physics, 1, 1 / 60);
    physics.release();
    const moving = run(physics, 2, 1 / 60);
    expect(moving).toBe(false);
    expect(Array.from(physics.offset)).toEqual([0, 0]);
  });

  it("still snaps everything to rest at once and ignores new events", () => {
    const { xs, zs } = line(3);
    const physics = new CorePhysics(xs, zs);
    physics.press(1);
    physics.aim(0, 0, -1, 0);
    physics.step(1 / 60, false);
    expect(physics.step(1 / 60, true)).toBe(false);
    expect(Array.from(physics.offset)).toEqual([0, 0, 0]);
    physics.press(0);
    physics.ripple(2, 0.3);
    expect(physics.step(1 / 60, false)).toBe(false);
    expect(Array.from(physics.offset)).toEqual([0, 0, 0]);
    // Motion back on: events work again.
    physics.press(0);
    expect(physics.step(1 / 60, false)).toBe(true);
  });

  it("ignores out-of-range indices", () => {
    const { xs, zs } = line(2);
    const physics = new CorePhysics(xs, zs);
    physics.press(-1);
    physics.press(9);
    physics.ripple(5, 0.3);
    expect(physics.step(1 / 60, false)).toBe(false);
  });

  it("many overlapping ripples stay bounded (the pool recycles its oldest source)", () => {
    const { xs, zs } = line(6);
    const physics = new CorePhysics(xs, zs);
    for (let n = 0; n < 20; n++) physics.ripple(n % 6, 0.2);
    let maxAbs = 0;
    const moving = run(physics, 5, 1 / 60, () => {
      for (const o of physics.offset) maxAbs = Math.max(maxAbs, Math.abs(o));
    });
    expect(Number.isFinite(maxAbs)).toBe(true);
    expect(maxAbs).toBeLessThan(1.2);
    expect(moving).toBe(false);
  });
});

describe("rayHexPrism", () => {
  // Flat-top hexagon: corners on the x axis, flat sides at z = ±apothem.
  const a = 0.9 * 0.8660254;

  it("hits the top face of a prism from straight above", () => {
    expect(rayHexPrism(0, 10, 0, 0, -1, 0, 0, 0, a, 0, 2)).toBeCloseTo(8, 6);
  });

  it("misses beyond a flat side and beyond a corner's cut", () => {
    expect(rayHexPrism(0, 10, a + 0.01, 0, -1, 0, 0, 0, a, 0, 2)).toBe(Infinity);
    // Inside the bounding square but outside the hexagon, near a corner.
    expect(rayHexPrism(0.8, 10, 0.6, 0, -1, 0, 0, 0, a, 0, 2)).toBe(Infinity);
    expect(rayHexPrism(0.8, 10, 0.1, 0, -1, 0, 0, 0, a, 0, 2)).toBeCloseTo(8, 6);
  });

  it("hits a side face from the side, and respects the prism's base", () => {
    expect(rayHexPrism(0, 1, -10, 0, 0, 1, 0, 0, a, 0, 2)).toBeCloseTo(10 - a, 6);
    expect(rayHexPrism(0, -0.5, -10, 0, 0, 1, 0, 0, a, 0, 2)).toBe(Infinity);
    expect(rayHexPrism(0, 2.5, -10, 0, 0, 1, 0, 0, a, 0, 2)).toBe(Infinity);
  });

  it("follows the prism's centre", () => {
    expect(rayHexPrism(3, 10, 2, 0, -1, 0, 3, 2, a, 0, 1)).toBeCloseTo(9, 6);
    expect(rayHexPrism(0, 10, 0, 0, -1, 0, 3, 2, a, 0, 1)).toBe(Infinity);
  });

  it("ignores prisms behind the ray", () => {
    expect(rayHexPrism(0, 10, 0, 0, 1, 0, 0, 0, a, 0, 2)).toBe(Infinity);
  });
});

describe("rayPlaneY", () => {
  it("meets a horizontal plane ahead of the ray only", () => {
    expect(rayPlaneY(10, -1, 0.8)).toBeCloseTo(9.2, 6);
    expect(rayPlaneY(10, 1, 0.8)).toBe(Infinity);
    expect(rayPlaneY(10, 0, 0.8)).toBe(Infinity);
  });
});

describe("resolveHover (hysteresis)", () => {
  it("takes the first hit at once when nothing is hovered", () => {
    const latch = createHoverLatch();
    expect(resolveHover(latch, 3, false, 0)).toBe(3);
  });

  it("keeps the hovered prism while the ray still hits it behind another", () => {
    const latch = createHoverLatch();
    resolveHover(latch, 3, false, 0);
    expect(resolveHover(latch, 4, true, 10)).toBe(3);
    expect(resolveHover(latch, 3, true, 20)).toBe(3);
    // The other prism came and went: its 80 ms start again.
    expect(resolveHover(latch, 4, true, 30)).toBe(3);
    expect(resolveHover(latch, 4, true, 30 + HOVER_SWITCH_MS - 1)).toBe(3);
    expect(resolveHover(latch, 4, true, 30 + HOVER_SWITCH_MS)).toBe(4);
  });

  it("switches at once when the ray no longer hits the hovered prism", () => {
    const latch = createHoverLatch();
    resolveHover(latch, 3, false, 0);
    expect(resolveHover(latch, 4, false, 10)).toBe(4);
    expect(resolveHover(latch, -1, false, 20)).toBe(-1);
  });

  it("forgets a stale hover after a pause in picking", () => {
    const latch = createHoverLatch();
    resolveHover(latch, 3, false, 0);
    expect(resolveHover(latch, 4, true, 1000)).toBe(4);
  });
});
