import { describe, expect, it } from "vitest";
import { STOP_ARM_MS, STOP_MULTI_CLICK_MS, acceptStopPress } from "./stop-guard";

describe("acceptStopPress", () => {
  const sent = 10_000;

  it("ignores a pointer press on Stop right after sending (a double-click on Send)", () => {
    // The second click of a double-click lands where Send was, now Stop.
    expect(acceptStopPress({ clickCount: 2, now: sent + 120, busySince: sent })).toBe(false);
    expect(acceptStopPress({ clickCount: 1, now: sent + 50, busySince: sent })).toBe(false);
    expect(acceptStopPress({ clickCount: 1, now: sent + STOP_ARM_MS - 1, busySince: sent })).toBe(false);
  });

  it("accepts a single pointer press once the window has passed", () => {
    expect(acceptStopPress({ clickCount: 1, now: sent + STOP_ARM_MS, busySince: sent })).toBe(true);
    expect(acceptStopPress({ clickCount: 1, now: sent + 3_000, busySince: sent })).toBe(true);
  });

  it("ignores the tail of a slow multi-click that began on Send", () => {
    // A slow double-click (OS intervals reach ~500ms) still counts as one gesture.
    expect(acceptStopPress({ clickCount: 2, now: sent + 480, busySince: sent })).toBe(false);
    expect(acceptStopPress({ clickCount: 3, now: sent + STOP_MULTI_CLICK_MS - 1, busySince: sent })).toBe(false);
    // Well after sending, a deliberate double-click on Stop stops.
    expect(acceptStopPress({ clickCount: 2, now: sent + STOP_MULTI_CLICK_MS, busySince: sent })).toBe(true);
  });

  it("always accepts keyboard or assistive-technology activation (detail 0)", () => {
    expect(acceptStopPress({ clickCount: 0, now: sent, busySince: sent })).toBe(true);
    expect(acceptStopPress({ clickCount: 0, now: sent + 10, busySince: sent })).toBe(true);
  });

  it("accepts when the start of the answer is unknown", () => {
    expect(acceptStopPress({ clickCount: 1, now: sent, busySince: null })).toBe(true);
  });

  it("does not trap Stop when the clock reads earlier than the send", () => {
    // A non-monotonic or rebased clock must not disable Stop for good.
    expect(acceptStopPress({ clickCount: 1, now: sent - 5_000, busySince: sent })).toBe(true);
  });

  it("keeps the windows ordered and short", () => {
    expect(STOP_ARM_MS).toBeGreaterThanOrEqual(300);
    expect(STOP_ARM_MS).toBeLessThanOrEqual(500);
    expect(STOP_MULTI_CLICK_MS).toBeGreaterThan(STOP_ARM_MS);
    expect(STOP_MULTI_CLICK_MS).toBeLessThanOrEqual(1_000);
  });
});
