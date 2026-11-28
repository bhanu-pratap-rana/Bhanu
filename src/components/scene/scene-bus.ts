// Shared state between the hero's readout and the 3D core: which demo
// question is showing, whether the visitor paused the motion, and whether
// the core is there at all (loading, docked in the copilot window), so the
// hero never points at a missing picture.

import { useSyncExternalStore } from "react";

/**
 * pending: not booted yet; ready: the renderer exists and can take the
 * copilot's dock, nothing drawn yet; on: drawn its first frame; lost: the
 * GPU context is gone for now (the dock shows the 2D lattice until it is
 * restored); off: will not draw here.
 */
export type CoreStatus = "pending" | "ready" | "on" | "lost" | "off";

/** The 3D core can stand in the copilot window's dock for the 2D lattice. */
export function coreCanDock(status: CoreStatus): boolean {
  return status === "ready" || status === "on";
}

/**
 * The core is on its way but has not drawn a frame yet: not booted, or the
 * renderer is up and its first frame is still to come. "off" and "lost"
 * are not loading (nothing is coming); "on" has drawn.
 */
export function coreIsLoading(status: CoreStatus): boolean {
  return status === "pending" || status === "ready";
}

export type SceneBusState = {
  /** Index into the demo frames while the idle demo runs. */
  demo: number;
  /** The visitor paused all motion. */
  paused: boolean;
  /** The visitor's system asks for reduced motion. */
  reduced: boolean;
  core: CoreStatus;
  /** The hero (and with it the idle demo's readout) is on screen. */
  heroInView: boolean;
  /**
   * How far the hero has left the view, 0 (in place) to 1 (gone; also on a
   * page without a hero). Written by MemoryCore's staging on every route,
   * with or without WebGL, in steps of 0.01 (core-stage heroExitProgress);
   * the launcher reads it to light its glyph as the hero hands off (0.4 to
   * 0.8). 0 until the staging first runs.
   */
  heroExit: number;
  /**
   * coreIsLoading(core), kept in step by `set`: the 3D core will draw but
   * has not drawn its first frame. True on the server and at first paint,
   * so the hero can show its 2D stand-in (HeroStageFallback) until the core
   * arrives, then cross-fade (the canvas fades in over 1.4s, globals.css).
   */
  coreLoading: boolean;
  /**
   * The core belongs to the laptop copilot window: docked in it, or flying
   * into it. False in the hero, and from the moment it starts flying back
   * (with motion off it simply moves). Written by MemoryCore's staging; the
   * hero shows its 2D stand-in meanwhile, so it is never left empty.
   */
  coreDocked: boolean;
};

const INITIAL: SceneBusState = {
  demo: 0,
  paused: false,
  reduced: false,
  core: "pending",
  heroInView: true,
  heroExit: 0,
  coreLoading: true,
  coreDocked: false,
};
let state: SceneBusState = INITIAL;
const listeners = new Set<() => void>();
const SERVER_STATE: SceneBusState = INITIAL;

export const sceneBus = {
  get: () => state,
  set(patch: Partial<SceneBusState>) {
    state = { ...state, ...patch };
    if (patch.core !== undefined) state.coreLoading = coreIsLoading(patch.core);
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useSceneBus<T>(selector: (s: SceneBusState) => T): T {
  return useSyncExternalStore(
    sceneBus.subscribe,
    () => selector(sceneBus.get()),
    () => selector(SERVER_STATE),
  );
}

export const PAUSE_KEY = "motion-paused";
