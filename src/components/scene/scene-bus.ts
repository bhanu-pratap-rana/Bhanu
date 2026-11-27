// Shared state between the hero's readout and the 3D core: which demo
// question is showing, whether the visitor paused the motion, and whether
// the core is there at all, so the hero never points at a missing picture.

import { useSyncExternalStore } from "react";

/** pending: not booted yet; on: drawn its first frame; off: will not draw here. */
export type CoreStatus = "pending" | "on" | "off";

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
};

const INITIAL: SceneBusState = {
  demo: 0,
  paused: false,
  reduced: false,
  core: "pending",
  heroInView: true,
};
let state: SceneBusState = INITIAL;
const listeners = new Set<() => void>();
const SERVER_STATE: SceneBusState = INITIAL;

export const sceneBus = {
  get: () => state,
  set(patch: Partial<SceneBusState>) {
    state = { ...state, ...patch };
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
