import { describe, expect, it } from "vitest";
import {
  AMBIENT_MIN_MS,
  AMBIENT_MIN_MS_LOW,
  IDLE_POLL_MS,
  type LoopHost,
  ambientFrameMs,
  createFrameLoop,
} from "./core-loop";

/** A stubbed browser: rAF callbacks and timers run only when the test says. */
function fakeHost() {
  let id = 0;
  const frames = new Map<number, (now: number) => void>();
  const timers = new Map<number, { cb: () => void; at: number }>();
  let clock = 0;
  const host: LoopHost = {
    raf(cb) {
      frames.set(++id, cb);
      return id;
    },
    caf(handle) {
      frames.delete(handle);
    },
    setTimeout(cb, ms) {
      timers.set(++id, { cb, at: clock + ms });
      return id;
    },
    clearTimeout(handle) {
      timers.delete(handle);
    },
  };
  return {
    host,
    pendingFrames: () => frames.size,
    pendingTimers: () => timers.size,
    /** Run the pending rAF callbacks, as one vsync at `now`. */
    vsync(now: number) {
      clock = now;
      const due = [...frames.values()];
      frames.clear();
      for (const cb of due) cb(now);
    },
    /** Advance the clock and fire the timers that are due. */
    advance(ms: number) {
      clock += ms;
      for (const [handle, t] of [...timers]) {
        if (t.at <= clock) {
          timers.delete(handle);
          t.cb();
        }
      }
    },
  };
}

describe("createFrameLoop: the renderer's loop sleeps while nothing moves", () => {
  it("requests no frame before it starts", () => {
    const fake = fakeHost();
    const loop = createFrameLoop(() => true, fake.host);
    loop.wake();
    expect(fake.pendingFrames()).toBe(0);
    loop.start();
    expect(fake.pendingFrames()).toBe(1);
  });

  it("keeps one frame pending while the step is busy, however often it is woken", () => {
    const fake = fakeHost();
    const loop = createFrameLoop(() => true, fake.host);
    loop.start();
    loop.wake();
    loop.wake();
    expect(fake.pendingFrames()).toBe(1);
    fake.vsync(16);
    expect(fake.pendingFrames()).toBe(1);
    expect(fake.pendingTimers()).toBe(0);
  });

  it("stops requesting frames once quiet (nothing staged, hidden, settled), leaving one slow poll", () => {
    const fake = fakeHost();
    let busy = 3;
    const loop = createFrameLoop(() => busy-- > 0, fake.host);
    loop.start();
    for (let i = 1; i <= 6; i++) fake.vsync(i * 16);
    expect(fake.pendingFrames()).toBe(0);
    expect(fake.pendingTimers()).toBe(1);
    expect(loop.sleeping).toBe(true);
  });

  it("the poll looks again after IDLE_POLL_MS, so a missed wake never freezes the core", () => {
    const fake = fakeHost();
    let busy = false;
    const steps: boolean[] = [];
    const loop = createFrameLoop((_now, resumed) => {
      steps.push(resumed);
      return busy;
    }, fake.host);
    loop.start();
    fake.vsync(16);
    expect(loop.sleeping).toBe(true);
    // Something changed without a wake.
    busy = true;
    fake.advance(IDLE_POLL_MS - 1);
    expect(fake.pendingFrames()).toBe(0);
    fake.advance(1);
    expect(fake.pendingFrames()).toBe(1);
    fake.vsync(300);
    expect(steps).toEqual([false, true]);
    expect(fake.pendingFrames()).toBe(1);
  });

  it("a wake while asleep draws on the next frame, told it resumed (so the sleep is not elapsed time)", () => {
    const fake = fakeHost();
    const resumedAt: boolean[] = [];
    let busy = false;
    const loop = createFrameLoop((_now, resumed) => {
      resumedAt.push(resumed);
      return busy;
    }, fake.host);
    loop.start();
    fake.vsync(16);
    expect(loop.sleeping).toBe(true);
    busy = true;
    loop.wake();
    expect(fake.pendingTimers()).toBe(0);
    expect(fake.pendingFrames()).toBe(1);
    fake.vsync(5000);
    fake.vsync(5016);
    expect(resumedAt).toEqual([false, true, false]);
  });

  it("dispose cancels the frame and the poll", () => {
    const fake = fakeHost();
    let calls = 0;
    const loop = createFrameLoop(() => {
      calls++;
      return false;
    }, fake.host);
    loop.start();
    fake.vsync(16);
    loop.dispose();
    expect(fake.pendingTimers()).toBe(0);
    fake.advance(IDLE_POLL_MS * 4);
    loop.wake();
    expect(fake.pendingFrames()).toBe(0);
    expect(calls).toBe(1);
  });
});

describe("ambientFrameMs: idle drift is capped on every device", () => {
  it("is 12ms on a laptop, 32ms on a phone and in the dock", () => {
    expect(ambientFrameMs(false, "hero")).toBe(AMBIENT_MIN_MS);
    expect(ambientFrameMs(true, "hero")).toBe(AMBIENT_MIN_MS_LOW);
    expect(ambientFrameMs(false, "dock")).toBe(AMBIENT_MIN_MS_LOW);
  });

  /** Draws in one second of vsyncs at `hz`, skipping frames sooner than `minMs` after the last draw. */
  function drawsPerSecond(hz: number, minMs: number): number {
    let last = -Infinity;
    let draws = 0;
    for (let i = 0; i < hz; i++) {
      const now = (i * 1000) / hz;
      if (now - last < minMs) continue;
      last = now;
      draws++;
    }
    return draws;
  }

  it.each([
    [60, AMBIENT_MIN_MS, 60],
    [120, AMBIENT_MIN_MS, 60],
    [144, AMBIENT_MIN_MS, 72],
    [60, AMBIENT_MIN_MS_LOW, 30],
    [120, AMBIENT_MIN_MS_LOW, 30],
  ])("at %i Hz with a %i ms cap draws %i fps", (hz, minMs, fps) => {
    expect(drawsPerSecond(hz, minMs)).toBe(fps);
  });
});
