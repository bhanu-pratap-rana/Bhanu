import { describe, expect, it } from "vitest";
import { type CoreStatus, coreCanDock, coreIsLoading, sceneBus } from "./scene-bus";

const ALL: CoreStatus[] = ["pending", "ready", "on", "lost", "off"];

describe("coreIsLoading: the hero shows its 2D stand-in meanwhile", () => {
  it("is loading until the first frame is drawn, and only then", () => {
    expect(ALL.filter(coreIsLoading)).toEqual(["pending", "ready"]);
  });

  it("never claims loading for a core that will not draw or has lost its GPU", () => {
    expect(coreIsLoading("off")).toBe(false);
    expect(coreIsLoading("lost")).toBe(false);
  });

  it("a dockable core may still be loading (ready: renderer up, nothing drawn yet)", () => {
    expect(coreCanDock("ready") && coreIsLoading("ready")).toBe(true);
  });
});

describe("sceneBus: core state fields", () => {
  it("starts loading and not docked (server and first client render agree)", () => {
    const s = sceneBus.get();
    expect(s.core).toBe("pending");
    expect(s.coreLoading).toBe(true);
    expect(s.coreDocked).toBe(false);
  });

  it("keeps coreLoading in step with core on every write", () => {
    for (const core of ALL) {
      sceneBus.set({ core });
      expect(sceneBus.get().coreLoading).toBe(coreIsLoading(core));
    }
    // A write that does not touch `core` leaves it alone.
    sceneBus.set({ core: "on" });
    sceneBus.set({ coreDocked: true });
    expect(sceneBus.get()).toMatchObject({ core: "on", coreLoading: false, coreDocked: true });
    sceneBus.set({ core: "pending", coreDocked: false });
  });
});
