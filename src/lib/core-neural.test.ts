import { describe, expect, it } from "vitest";
import { ORB_HEIGHT } from "./core-stage";
import { axialToWorld, hexSpiral } from "./honeycomb";
import {
  NEURAL,
  afterglow,
  burstLength,
  hiddenArrival,
  hiddenLayer,
  hop,
  idleBurstDue,
  nearestHidden,
  neuralFromSearch,
  prismHopDelay,
  signalAlpha,
} from "./core-neural";

const CELLS = hexSpiral(26).map((cell) => axialToWorld(cell, 1));

describe("neuralFromSearch: the neural core is the default", () => {
  it("is on without the parameter, for ?core=neural and for any unknown value", () => {
    for (const search of [
      "",
      "?",
      "?core=",
      "?core=neural",
      "?x=1&core=neural",
      "core=neural",
      "?core=Neural",
      "?core=prisms",
      "?core=Classic",
      "?core=classic2",
      "?classic",
    ]) {
      expect(neuralFromSearch(search)).toBe(true);
    }
  });

  it("is off only for ?core=classic (exact), kept for comparison", () => {
    expect(neuralFromSearch("?core=classic")).toBe(false);
    expect(neuralFromSearch("?x=1&core=classic")).toBe(false);
    expect(neuralFromSearch("core=classic")).toBe(false);
  });
});

describe("hiddenLayer: 7 nodes on a ring at ~60% of the orb's height", () => {
  const hidden = hiddenLayer();

  it("has 7 nodes, 3 floats each", () => {
    expect(NEURAL.HIDDEN).toBe(7);
    expect(hidden).toHaveLength(21);
  });

  it("puts every node at 0.6 x the orb height, on one ring around the axis", () => {
    for (let j = 0; j < NEURAL.HIDDEN; j++) {
      expect(hidden[j * 3 + 1]).toBeCloseTo(ORB_HEIGHT * 0.6, 5);
      expect(Math.hypot(hidden[j * 3], hidden[j * 3 + 2])).toBeCloseTo(NEURAL.RING_R, 5);
    }
  });

  it("spaces the nodes evenly", () => {
    const angles = Array.from({ length: 7 }, (_, j) => Math.atan2(hidden[j * 3 + 2], hidden[j * 3]));
    for (let j = 0; j < 7; j++) {
      const a = angles[j];
      const b = angles[(j + 1) % 7];
      const gap = (((b - a) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      expect(gap).toBeCloseTo((2 * Math.PI) / 7, 5);
    }
  });

  it("sits inside the core's drawn bounds (the renderer's scissor cone)", () => {
    // core-renderer: BOUND_TOP_R 6.2 at y 7.6, BOUND_BOTTOM_R 6.4 at y -0.6.
    expect(NEURAL.RING_R + NEURAL.NODE_R).toBeLessThan(6.2);
  });
});

describe("nearestHidden: each prism listens to its 2 nearest hidden nodes", () => {
  const hidden = hiddenLayer();
  const nearest = nearestHidden(CELLS, hidden);

  it("gives two distinct nodes per prism", () => {
    expect(nearest).toHaveLength(CELLS.length * 2);
    for (let i = 0; i < CELLS.length; i++) {
      const [a, b] = [nearest[i * 2], nearest[i * 2 + 1]];
      expect(a).not.toBe(b);
      for (const j of [a, b]) {
        expect(j).toBeGreaterThanOrEqual(0);
        expect(j).toBeLessThan(7);
      }
    }
  });

  it("are the two nearest in the ground plane, nearest first", () => {
    const d = (i: number, j: number) => Math.hypot(CELLS[i].x - hidden[j * 3], CELLS[i].z - hidden[j * 3 + 2]);
    for (let i = 0; i < CELLS.length; i++) {
      const [a, b] = [nearest[i * 2], nearest[i * 2 + 1]];
      expect(d(i, a)).toBeLessThanOrEqual(d(i, b));
      for (let j = 0; j < 7; j++) {
        if (j === a || j === b) continue;
        expect(d(i, b)).toBeLessThanOrEqual(d(i, j) + 1e-9);
      }
    }
  });

  it("uses every hidden node for some prism (no dead neuron)", () => {
    expect(new Set(nearest).size).toBe(7);
  });
});

describe("signals: orb -> hidden -> lit prisms over ~700ms", () => {
  it("hop: not started, travelling 0..1, then done", () => {
    expect(hop(0.1, 0.2)).toBe(-1);
    expect(hop(0.2, 0.2)).toBe(0);
    expect(hop(0.2 + NEURAL.HOP_S / 2, 0.2)).toBeCloseTo(0.5, 9);
    expect(hop(0.2 + NEURAL.HOP_S, 0.2)).toBe(-1);
  });

  it("each hidden node is reached after its staggered first hop", () => {
    for (let j = 0; j < 7; j++) {
      expect(hiddenArrival(j)).toBeCloseTo(j * NEURAL.HIDDEN_STAGGER_S + NEURAL.HOP_S, 9);
    }
  });

  it("a prism's signal leaves its hidden node once the node has been reached", () => {
    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 7; j++) {
        expect(prismHopDelay(i, j)).toBeGreaterThanOrEqual(hiddenArrival(j));
        expect(prismHopDelay(i, j)).toBeLessThanOrEqual(hiddenArrival(j) + NEURAL.PRISM_STAGGER_S);
      }
    }
  });

  it("is staggered: not every prism's signal leaves at once", () => {
    const delays = new Set(Array.from({ length: 26 }, (_, i) => prismHopDelay(i, 0).toFixed(4)));
    expect(delays.size).toBeGreaterThan(5);
  });

  it("the whole burst lasts about 700ms", () => {
    expect(burstLength()).toBeGreaterThanOrEqual(0.6);
    expect(burstLength()).toBeLessThanOrEqual(0.78);
    // Every hop of every prism ends inside it.
    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 7; j++) expect(prismHopDelay(i, j) + NEURAL.HOP_S).toBeLessThanOrEqual(burstLength() + 1e-9);
    }
  });

  it("signalAlpha is bright while travelling and fades in and out at the ends", () => {
    expect(signalAlpha(-1)).toBe(0);
    expect(signalAlpha(0.5)).toBe(1);
    expect(signalAlpha(0)).toBeLessThan(1);
    expect(signalAlpha(0.999)).toBeLessThan(0.05);
    for (let k = 0; k <= 100; k++) {
      const a = signalAlpha(k / 100);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it("afterglow: a node flashes when the signal arrives, then settles", () => {
    expect(afterglow(-0.01)).toBe(0);
    expect(afterglow(0)).toBe(1);
    expect(afterglow(0.2)).toBeLessThan(afterglow(0.05));
    expect(afterglow(1)).toBeLessThan(0.05);
  });
});

describe("idleBurstDue: one slow pulse every ~4s", () => {
  it("waits the period since the last burst began", () => {
    expect(NEURAL.IDLE_PERIOD_S).toBeGreaterThanOrEqual(3.5);
    expect(NEURAL.IDLE_PERIOD_S).toBeLessThanOrEqual(4.5);
    expect(idleBurstDue(10, 10 + NEURAL.IDLE_PERIOD_S - 0.01)).toBe(false);
    expect(idleBurstDue(10, 10 + NEURAL.IDLE_PERIOD_S)).toBe(true);
  });

  it("is due at once when there was never a burst", () => {
    expect(idleBurstDue(Number.NEGATIVE_INFINITY, 0)).toBe(true);
  });
});
