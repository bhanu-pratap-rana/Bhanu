// The memory core's frame loop, apart from the renderer so it is testable
// without a GPU. It runs on requestAnimationFrame while there is something to
// draw and sleeps otherwise (the tab or a dialog hides the core, nothing is
// staged, or the core has settled), polling slowly while asleep, so an input
// path that forgets to wake it costs a little latency, never a frozen core.

import type { CoreKind } from "./core-stage";

/** While nothing moves the loop sleeps and looks again this often (ms). */
export const IDLE_POLL_MS = 250;
/**
 * Idle drift (nothing tracked moving) is drawn at most this often (ms): 60
 * fps on a 120 Hz laptop, 72 on 144 Hz; a 60 Hz screen draws every frame.
 */
export const AMBIENT_MIN_MS = 12;
/** Phones, and the small docked core on any screen: 30 fps. */
export const AMBIENT_MIN_MS_LOW = 32;

/** The least time between two drawn frames of idle drift. */
export function ambientFrameMs(coarse: boolean, kind: CoreKind): number {
  return coarse || kind === "dock" ? AMBIENT_MIN_MS_LOW : AMBIENT_MIN_MS;
}

export type LoopHost = {
  raf(cb: (now: number) => void): number;
  caf(handle: number): void;
  setTimeout(cb: () => void, ms: number): number;
  clearTimeout(handle: number): void;
};

function browserHost(): LoopHost {
  return {
    raf: (cb) => window.requestAnimationFrame(cb),
    caf: (handle) => window.cancelAnimationFrame(handle),
    setTimeout: (cb, ms) => window.setTimeout(cb, ms),
    clearTimeout: (handle) => window.clearTimeout(handle),
  };
}

export type FrameLoop = {
  /** Begin (the shaders are ready); wakes before this are ignored. */
  start(): void;
  /** Draw on the next frame: an input changed. Cheap; call it freely. */
  wake(): void;
  dispose(): void;
  /** Asleep on the poll timer, no frame requested. */
  readonly sleeping: boolean;
};

/**
 * `step(now, resumed)` runs once per frame and returns true while it has
 * more to do next frame. `resumed` is true on the first frame after a sleep,
 * so the step can restart its clock instead of counting the sleep.
 */
export function createFrameLoop(
  step: (now: number, resumed: boolean) => boolean,
  host: LoopHost = browserHost(),
  pollMs = IDLE_POLL_MS,
): FrameLoop {
  let started = false;
  let disposed = false;
  let pending = false;
  let frame = 0;
  let timer = 0;
  let resumed = false;

  function wake() {
    if (disposed || !started) return;
    if (timer) {
      host.clearTimeout(timer);
      timer = 0;
      resumed = true;
    }
    if (pending) return;
    pending = true;
    frame = host.raf(tick);
  }

  function tick(now: number) {
    pending = false;
    if (disposed) return;
    const wasAsleep = resumed;
    resumed = false;
    if (step(now, wasAsleep)) wake();
    else if (!disposed && !timer && !pending) timer = host.setTimeout(wake, pollMs);
  }

  return {
    start() {
      if (started || disposed) return;
      started = true;
      wake();
    },
    wake,
    dispose() {
      disposed = true;
      host.caf(frame);
      host.clearTimeout(timer);
      timer = 0;
    },
    get sleeping() {
      return timer !== 0;
    },
  };
}
