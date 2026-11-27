// Shared state between the hero's readout and the 3D core: which demo
// question is showing, and whether the visitor paused the motion.

import { useSyncExternalStore } from "react";

export type SceneBusState = {
  /** Index into the demo frames while the idle demo runs. */
  demo: number;
  /** The visitor paused all motion. */
  paused: boolean;
  /** The visitor's system asks for reduced motion. */
  reduced: boolean;
};

let state: SceneBusState = { demo: 0, paused: false, reduced: false };
const listeners = new Set<() => void>();
const SERVER_STATE: SceneBusState = { demo: 0, paused: false, reduced: false };

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
