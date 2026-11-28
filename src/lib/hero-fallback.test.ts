import { describe, expect, it } from "vitest";
import { heroFallbackShown } from "./hero-fallback";

describe("heroFallbackShown", () => {
  it("fills the stage while the core is still loading", () => {
    expect(heroFallbackShown({ core: "pending", docked: false })).toBe(true);
    // The renderer exists but has drawn nothing yet.
    expect(heroFallbackShown({ core: "ready", docked: false })).toBe(true);
  });

  it("fills the stage when the core will not draw or its GPU context is gone", () => {
    expect(heroFallbackShown({ core: "off", docked: false })).toBe(true);
    expect(heroFallbackShown({ core: "lost", docked: false })).toBe(true);
  });

  it("steps aside once the core has drawn in the hero", () => {
    expect(heroFallbackShown({ core: "on", docked: false })).toBe(false);
  });

  it("fills the stage while the core is away in the copilot window's dock", () => {
    expect(heroFallbackShown({ core: "on", docked: true })).toBe(true);
    expect(heroFallbackShown({ core: "ready", docked: true })).toBe(true);
  });
});
