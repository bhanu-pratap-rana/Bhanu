import { describe, expect, it } from "vitest";
import { scrollBehavior } from "./motion";

describe("scrollBehavior", () => {
  it("returns 'auto' when reduced motion is preferred", () => {
    expect(scrollBehavior(true)).toBe("auto");
  });

  it("returns 'smooth' otherwise", () => {
    expect(scrollBehavior(false)).toBe("smooth");
  });
});
