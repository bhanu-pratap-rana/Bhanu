import { describe, expect, it } from "vitest";
import {
  CHIP_FAST_PX_PER_S,
  CHIP_REST_MS,
  LAUNCHER_INTRO_MS,
  LAUNCHER_NAME,
  chipFromScroll,
  chipShown,
  flipFrom,
  glyphLevels,
  introActive,
  launcherView,
  launcherVisible,
  nextUnseen,
  type LauncherMode,
} from "./launcher-state";

describe("launcherView", () => {
  const base = { open: false, busy: false, unseenAnswer: false };

  it("maps the chat state to one mode, open first", () => {
    expect(launcherView(base).mode).toBe("idle");
    expect(launcherView({ ...base, busy: true }).mode).toBe("busy");
    expect(launcherView({ ...base, unseenAnswer: true }).mode).toBe("ready");
    expect(launcherView({ ...base, busy: true, unseenAnswer: true }).mode).toBe(
      "busy",
    );
    expect(launcherView({ ...base, open: true, busy: true }).mode).toBe("open");
  });

  it("gives each closed state its visible label", () => {
    expect(launcherView(base).label).toBe("Ask my copilot");
    expect(launcherView({ ...base, busy: true }).label).toBe(
      "Ask my copilot · answering…",
    );
    expect(launcherView({ ...base, unseenAnswer: true }).label).toBe(
      "Ask my copilot · answer ready",
    );
  });

  it("starts every visible label with the accessible name (WCAG 2.5.3)", () => {
    const states = [
      base,
      { ...base, busy: true },
      { ...base, unseenAnswer: true },
      { ...base, open: true },
    ];
    for (const state of states) {
      const view = launcherView(state);
      expect(view.label.startsWith(view.name)).toBe(true);
      expect(view.label.startsWith(LAUNCHER_NAME)).toBe(true);
    }
  });

  it("never changes the accessible name, whatever the state", () => {
    const states = [
      base,
      { ...base, busy: true },
      { ...base, unseenAnswer: true },
      { ...base, open: true },
      { open: true, busy: true, unseenAnswer: true },
    ];
    for (const state of states) {
      expect(launcherView(state).name).toBe(LAUNCHER_NAME);
    }
    expect(LAUNCHER_NAME).toBe("Ask my copilot");
  });

  it("describes busy and ready in words, nothing at rest", () => {
    expect(launcherView(base).description).toBe("");
    expect(launcherView({ ...base, open: true }).description).toBe("");
    expect(launcherView({ ...base, busy: true }).description).not.toBe("");
    expect(launcherView({ ...base, unseenAnswer: true }).description).not.toBe(
      "",
    );
  });
});

describe("launcherVisible", () => {
  const base = { sentinelInView: false, open: false, busy: false, focused: false };

  it("shows once the hero CTA has left the view, and on pages without one", () => {
    expect(launcherVisible(base)).toBe(true);
  });

  it("hides while the hero CTA is in view", () => {
    expect(launcherVisible({ ...base, sentinelInView: true })).toBe(false);
  });

  it("stays while the copilot is open or busy, or the launcher has focus", () => {
    const inView = { ...base, sentinelInView: true };
    expect(launcherVisible({ ...inView, open: true })).toBe(true);
    expect(launcherVisible({ ...inView, busy: true })).toBe(true);
    expect(launcherVisible({ ...inView, focused: true })).toBe(true);
  });
});

describe("nextUnseen", () => {
  it("marks an answer that finished while the copilot was closed", () => {
    expect(nextUnseen(false, { wasBusy: true, busy: false, open: false })).toBe(
      true,
    );
  });

  it("does not mark one that finished in view", () => {
    expect(nextUnseen(false, { wasBusy: true, busy: false, open: true })).toBe(
      false,
    );
  });

  it("clears once the copilot is opened, and keeps it otherwise", () => {
    expect(nextUnseen(true, { wasBusy: false, busy: false, open: true })).toBe(
      false,
    );
    expect(nextUnseen(true, { wasBusy: false, busy: false, open: false })).toBe(
      true,
    );
    expect(nextUnseen(true, { wasBusy: false, busy: true, open: false })).toBe(
      false,
    );
  });
});

describe("chipFromScroll", () => {
  it("shows the label once the page has rested long enough", () => {
    expect(chipFromScroll(false, { velocity: 900, idleMs: CHIP_REST_MS })).toBe(
      true,
    );
  });

  it("shows it while scrolling up", () => {
    expect(chipFromScroll(false, { velocity: -50, idleMs: 0 })).toBe(true);
  });

  it("collapses it while scrolling down fast", () => {
    expect(
      chipFromScroll(true, { velocity: CHIP_FAST_PX_PER_S + 1, idleMs: 16 }),
    ).toBe(false);
  });

  it("keeps the previous state for a slow scroll down", () => {
    expect(chipFromScroll(true, { velocity: 120, idleMs: 16 })).toBe(true);
    expect(chipFromScroll(false, { velocity: 120, idleMs: 16 })).toBe(false);
  });
});

describe("chipShown", () => {
  const base = {
    used: true,
    mode: "idle" as LauncherMode,
    hovered: false,
    focused: false,
    scrollShown: false,
  };

  it("always shows the label until the first launcher interaction", () => {
    expect(chipShown({ ...base, used: false })).toBe(true);
  });

  it("then follows hover, focus and scrolling", () => {
    expect(chipShown(base)).toBe(false);
    expect(chipShown({ ...base, hovered: true })).toBe(true);
    expect(chipShown({ ...base, focused: true })).toBe(true);
    expect(chipShown({ ...base, scrollShown: true })).toBe(true);
  });

  it("on phones, ignores focus a tap or a closing dialog put there", () => {
    const phone = { ...base, compact: true };
    expect(chipShown({ ...phone, focused: true, focusVisible: false })).toBe(false);
    expect(chipShown({ ...phone, focused: true, focusVisible: true })).toBe(true);
  });

  it("hides it while the copilot is open: the window is its own label", () => {
    expect(
      chipShown({ ...base, used: false, hovered: true, mode: "open" }),
    ).toBe(false);
  });

  describe("on phones (compact)", () => {
    const phone = { ...base, compact: true };

    it("shows only the hex: no label from hover, scrolling or first use", () => {
      expect(chipShown(phone)).toBe(false);
      expect(chipShown({ ...phone, used: false })).toBe(false);
      expect(chipShown({ ...phone, scrollShown: true })).toBe(false);
      expect(chipShown({ ...phone, hovered: true })).toBe(false);
    });

    it("shows the label during its first appearance and on focus", () => {
      expect(chipShown({ ...phone, intro: true })).toBe(true);
      expect(chipShown({ ...phone, used: false, intro: true })).toBe(true);
      expect(chipShown({ ...phone, focused: true })).toBe(true);
    });

    it("still hides it while the copilot is open", () => {
      expect(chipShown({ ...phone, intro: true, focused: true, mode: "open" })).toBe(
        false,
      );
    });
  });
});

describe("introActive", () => {
  it("is on for LAUNCHER_INTRO_MS after the launcher first appears", () => {
    expect(LAUNCHER_INTRO_MS).toBe(3000);
    expect(introActive(null, 1000)).toBe(false);
    expect(introActive(1000, 1000)).toBe(true);
    expect(introActive(1000, 1000 + LAUNCHER_INTRO_MS - 1)).toBe(true);
    expect(introActive(1000, 1000 + LAUNCHER_INTRO_MS)).toBe(false);
  });
});

describe("glyphLevels", () => {
  const base = [0, 0.45, 0, 0.8, 0, 0, 0.28];

  it("shows the demo frame as is while the hero is on screen", () => {
    expect(glyphLevels(base, 0)).toEqual(base);
    expect(glyphLevels(base, 0.4)).toEqual(base);
  });

  it("lights the lit cells fully once the hero has handed off", () => {
    expect(glyphLevels(base, 0.8)).toEqual([0, 1, 0, 1, 0, 0, 1]);
    expect(glyphLevels(base, 1)).toEqual([0, 1, 0, 1, 0, 0, 1]);
  });

  it("brightens monotonically in between, and never lights a dark cell", () => {
    let prev = glyphLevels(base, 0.4);
    for (let k = 0.45; k <= 0.8; k += 0.05) {
      const next = glyphLevels(base, k);
      next.forEach((value, i) => {
        expect(value).toBeGreaterThanOrEqual(prev[i] - 1e-9);
        if (base[i] === 0) expect(value).toBe(0);
      });
      prev = next;
    }
  });

  it("treats a missing or broken exit value as the hero still showing", () => {
    expect(glyphLevels(base, Number.NaN)).toEqual(base);
  });
});

describe("flipFrom", () => {
  const corner = { x: 1350, y: 820, width: 36, height: 36 };

  it("returns the offset and scale that put the corner glyph on the CTA's", () => {
    const cta = { x: 100, y: -40, width: 18, height: 18 };
    const flip = flipFrom(cta, corner, 900);
    expect(flip).not.toBeNull();
    expect(flip!.scale).toBeCloseTo(0.5);
    // Centre to centre.
    expect(flip!.dx).toBeCloseTo(109 - 1368);
    expect(flip!.dy).toBeCloseTo(-31 - 838);
  });

  it("gives up when the CTA is far off screen or has no box", () => {
    expect(
      flipFrom({ x: 100, y: -2000, width: 18, height: 18 }, corner, 900),
    ).toBeNull();
    expect(
      flipFrom({ x: 100, y: 3000, width: 18, height: 18 }, corner, 900),
    ).toBeNull();
    expect(flipFrom({ x: 0, y: 0, width: 0, height: 0 }, corner, 900)).toBeNull();
    expect(
      flipFrom({ x: 1, y: 1, width: 18, height: 18 }, { ...corner, width: 0 }, 900),
    ).toBeNull();
  });
});
