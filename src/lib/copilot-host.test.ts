import { describe, expect, it } from "vitest";
import {
  DESKTOP_QUERY,
  FIELD_FOCUS_QUERY,
  TUCKED_STRIP_PX,
  desktopHostQuery,
  dialogCloseClosesCopilot,
  dialogFocusOnOpen,
  dialogSync,
  focusTargetOnOpen,
  isCloseKey,
  opensOnFocusRequest,
  returnFocusTarget,
  shouldCloseOnNavigate,
  tuckedStripRect,
  windowCloseEvent,
  windowObscures,
  windowPhase,
} from "./copilot-host";

describe("focusTargetOnOpen", () => {
  it("puts the caret in the field when the opening asked for it", () => {
    expect(
      focusTargetOnOpen({
        wasOpen: false,
        isOpen: true,
        prevFocusRequest: 3,
        focusRequest: 4,
      }),
    ).toBe("field");
  });

  it("focuses the heading when opened for an answer (no focus request)", () => {
    expect(
      focusTargetOnOpen({
        wasOpen: false,
        isOpen: true,
        prevFocusRequest: 4,
        focusRequest: 4,
      }),
    ).toBe("heading");
  });

  it("does nothing while it stays open: the composer takes later requests", () => {
    expect(
      focusTargetOnOpen({
        wasOpen: true,
        isOpen: true,
        prevFocusRequest: 4,
        focusRequest: 5,
      }),
    ).toBe("none");
  });

  it("does nothing when closing or staying closed", () => {
    expect(
      focusTargetOnOpen({
        wasOpen: true,
        isOpen: false,
        prevFocusRequest: 4,
        focusRequest: 5,
      }),
    ).toBe("none");
    expect(
      focusTargetOnOpen({
        wasOpen: false,
        isOpen: false,
        prevFocusRequest: 4,
        focusRequest: 4,
      }),
    ).toBe("none");
  });
});

describe("opensOnFocusRequest", () => {
  const base = {
    isDesktop: true,
    isOpen: false,
    prevFocusRequest: 1,
    focusRequest: 2,
  };

  it("opens the closed laptop column for a new focus request", () => {
    expect(opensOnFocusRequest(base)).toBe(true);
  });

  it("never opens the phone dialog on its own", () => {
    expect(opensOnFocusRequest({ ...base, isDesktop: false })).toBe(false);
  });

  it("ignores an already handled request and an already open column", () => {
    expect(opensOnFocusRequest({ ...base, focusRequest: 1 })).toBe(false);
    expect(opensOnFocusRequest({ ...base, isOpen: true })).toBe(false);
  });
});

describe("shouldCloseOnNavigate", () => {
  it("closes the phone dialog, which would cover the destination", () => {
    expect(shouldCloseOnNavigate(false)).toBe(true);
  });

  it("keeps the laptop column open: it sits beside the page", () => {
    expect(shouldCloseOnNavigate(true)).toBe(false);
  });
});

describe("returnFocusTarget", () => {
  type Fake = { name: string; ok: boolean };
  const usable = (el: Fake) => el.ok;
  const opener = { name: "opener", ok: true };
  const launcher = { name: "launcher", ok: true };
  const heroAsk = { name: "hero", ok: true };
  const main = { name: "main", ok: true };
  const gone = { name: "gone", ok: false };

  it("prefers the control that opened the window", () => {
    expect(
      returnFocusTarget({ opener, launcher, heroAsk, main }, usable),
    ).toBe("opener");
  });

  it("falls back to the launcher, which is always there", () => {
    // Opened by the skip link or a deep link: no opener was recorded.
    expect(
      returnFocusTarget({ opener: null, launcher, heroAsk, main }, usable),
    ).toBe("launcher");
    expect(
      returnFocusTarget({ opener: gone, launcher, heroAsk, main }, usable),
    ).toBe("launcher");
  });

  it("then to the hero's ask button, then to main", () => {
    expect(
      returnFocusTarget({ opener: null, launcher: gone, heroAsk, main }, usable),
    ).toBe("heroAsk");
    expect(
      returnFocusTarget(
        { opener: null, launcher: null, heroAsk: gone, main },
        usable,
      ),
    ).toBe("main");
  });

  it("returns null when nothing can take focus", () => {
    expect(
      returnFocusTarget(
        { opener: null, launcher: null, heroAsk: null, main: null },
        usable,
      ),
    ).toBeNull();
    expect(
      returnFocusTarget(
        { opener: null, launcher: gone, heroAsk: null, main: gone },
        usable,
      ),
    ).toBeNull();
  });
});

describe("isCloseKey", () => {
  const escape = {
    key: "Escape",
    isComposing: false,
    keyCode: 27,
    defaultPrevented: false,
  };

  it("closes on a plain Escape", () => {
    expect(isCloseKey(escape)).toBe(true);
  });

  it("leaves Escape to an input method that is composing", () => {
    expect(isCloseKey({ ...escape, isComposing: true })).toBe(false);
    expect(isCloseKey({ ...escape, keyCode: 229 })).toBe(false);
  });

  it("leaves Escape to a control inside that already handled it", () => {
    expect(isCloseKey({ ...escape, defaultPrevented: true })).toBe(false);
  });

  it("ignores other keys", () => {
    expect(isCloseKey({ ...escape, key: "Enter", keyCode: 13 })).toBe(false);
  });
});

describe("desktopHostQuery", () => {
  it("asks for a wide, tall-enough screen with a fine hovering pointer", () => {
    expect(desktopHostQuery()).toBe(
      "(min-width: 64rem) and (hover: hover) and (pointer: fine) and (min-height: 34rem)",
    );
    expect(DESKTOP_QUERY).toBe(desktopHostQuery());
  });
});

describe("windowPhase", () => {
  it("opens, then closes through a closing phase", () => {
    let phase = windowPhase("closed", { type: "open" });
    expect(phase).toBe("open");
    phase = windowPhase(phase, { type: "close", reduced: false });
    expect(phase).toBe("closing");
    phase = windowPhase(phase, { type: "done" });
    expect(phase).toBe("closed");
  });

  it("skips the closing phase under reduced motion", () => {
    expect(windowPhase("open", { type: "close", reduced: true })).toBe("closed");
  });

  it("survives a rapid open/close/open: a stale end does not hide it", () => {
    let phase = windowPhase("closed", { type: "open" });
    phase = windowPhase(phase, { type: "close", reduced: false });
    phase = windowPhase(phase, { type: "open" });
    expect(phase).toBe("open");
    // The exit animation's end (or its timer) arrives late.
    phase = windowPhase(phase, { type: "done" });
    expect(phase).toBe("open");
  });

  it("ignores a close while closed and an open while open", () => {
    expect(windowPhase("closed", { type: "close", reduced: false })).toBe(
      "closed",
    );
    expect(windowPhase("open", { type: "open" })).toBe("open");
    expect(windowPhase("closed", { type: "done" })).toBe("closed");
  });

  it("hides at once when the copilot moves to the phone dialog", () => {
    // Narrowing the screen with the copilot open: the dialog takes over and
    // covers the page, so the window has no exit to show, and a closing
    // window would keep a second panel mounted behind the dialog.
    expect(
      windowPhase("open", { type: "close", reduced: false, handOff: true }),
    ).toBe("closed");
  });
});

describe("windowCloseEvent", () => {
  it("is a plain close when the visitor closed the copilot", () => {
    expect(windowCloseEvent({ reduced: false, storeOpen: false })).toEqual({
      type: "close",
      reduced: false,
      handOff: false,
    });
  });

  it("is a hand-off when the copilot stays open but the window goes", () => {
    const event = windowCloseEvent({ reduced: false, storeOpen: true });
    expect(event).toEqual({ type: "close", reduced: false, handOff: true });
    expect(windowPhase("open", event)).toBe("closed");
  });

  it("keeps reduced motion", () => {
    expect(windowCloseEvent({ reduced: true, storeOpen: false }).reduced).toBe(
      true,
    );
  });
});

describe("dialogSync", () => {
  it("shows the dialog when the phone host should show the copilot", () => {
    expect(
      dialogSync({ showDialog: true, dialogOpen: false, storeOpen: true }),
    ).toBe("show");
  });

  it("hides it as a plain close when the copilot was closed", () => {
    expect(
      dialogSync({ showDialog: false, dialogOpen: true, storeOpen: false }),
    ).toBe("hide");
  });

  it("hands off to the laptop window when the copilot stays open", () => {
    // Widening the screen with the dialog open: dialog.close() fires the
    // dialog's close event, which must not close the copilot (regression:
    // the window opened and at once went to "closing").
    expect(
      dialogSync({ showDialog: false, dialogOpen: true, storeOpen: true }),
    ).toBe("hand-off");
  });

  it("does nothing when the dialog already matches", () => {
    expect(
      dialogSync({ showDialog: true, dialogOpen: true, storeOpen: true }),
    ).toBe("none");
    expect(
      dialogSync({ showDialog: false, dialogOpen: false, storeOpen: false }),
    ).toBe("none");
  });
});

describe("dialogCloseClosesCopilot", () => {
  it("closes the copilot when the visitor closed the dialog", () => {
    expect(
      dialogCloseClosesCopilot({ handingOff: false, dialogOpen: false }),
    ).toBe(true);
  });

  it("keeps it open for the close the host made to hand off", () => {
    expect(
      dialogCloseClosesCopilot({ handingOff: true, dialogOpen: false }),
    ).toBe(false);
  });

  it("ignores a stale close event once the dialog is open again", () => {
    expect(
      dialogCloseClosesCopilot({ handingOff: false, dialogOpen: true }),
    ).toBe(false);
  });
});

describe("host swap, phone to laptop, with the copilot open", () => {
  it("ends with the window open, the store open and focus on the window", () => {
    // The sequence CopilotHost runs, replayed through its rules.
    let storeOpen = true;
    let windowState: ReturnType<typeof windowPhase> = "closed";
    // 1. isDesktop flips: the window opens in the same render.
    windowState = windowPhase(windowState, { type: "open" });
    // 2. The dialog layout effect hides the dialog.
    const sync = dialogSync({
      showDialog: false,
      dialogOpen: true,
      storeOpen,
    });
    const handingOff = sync === "hand-off";
    // 3. The dialog's close event arrives (a task later).
    if (dialogCloseClosesCopilot({ handingOff, dialogOpen: false })) {
      storeOpen = false;
    }
    if (!storeOpen) {
      windowState = windowPhase(
        windowState,
        windowCloseEvent({ reduced: false, storeOpen }),
      );
    }
    expect(storeOpen).toBe(true);
    expect(windowState).toBe("open");
    // 4. The window effect: phones reset wasOpen, so the window takes focus.
    expect(
      focusTargetOnOpen({
        wasOpen: false,
        isOpen: true,
        prevFocusRequest: 2,
        focusRequest: 2,
      }),
    ).toBe("heading");
  });
});

describe("windowObscures", () => {
  const win = { x: 976, y: 80, width: 440, height: 712 };

  it("is true when the focused element sits under the window", () => {
    expect(windowObscures({ x: 1100, y: 300, width: 120, height: 44 }, win)).toBe(
      true,
    );
    // Partly under it, too.
    expect(windowObscures({ x: 900, y: 300, width: 120, height: 44 }, win)).toBe(
      true,
    );
  });

  it("is false beside it, and for edges that only touch", () => {
    expect(windowObscures({ x: 100, y: 300, width: 120, height: 44 }, win)).toBe(
      false,
    );
    expect(windowObscures({ x: 856, y: 300, width: 120, height: 44 }, win)).toBe(
      false,
    );
    expect(windowObscures({ x: 1100, y: 36, width: 120, height: 44 }, win)).toBe(
      false,
    );
  });

  it("is false for an element with no box", () => {
    expect(windowObscures({ x: 1100, y: 300, width: 0, height: 0 }, win)).toBe(
      false,
    );
  });
});

describe("dialogFocusOnOpen", () => {
  it("gives a touch phone the heading even when the open asked for the field", () => {
    // The hero CTA and the launcher ask for focus; on a phone that would
    // raise the keyboard over the starters.
    expect(dialogFocusOnOpen({ focusRequested: true, finePointer: false })).toBe(
      "heading",
    );
  });

  it("keeps the field for a fine pointer (a narrow laptop window)", () => {
    expect(dialogFocusOnOpen({ focusRequested: true, finePointer: true })).toBe(
      "field",
    );
  });

  it("focuses the heading when no focus was asked for", () => {
    expect(dialogFocusOnOpen({ focusRequested: false, finePointer: true })).toBe(
      "heading",
    );
    expect(dialogFocusOnOpen({ focusRequested: false, finePointer: false })).toBe(
      "heading",
    );
  });

  it("detects a fine pointer the way the laptop host does", () => {
    expect(FIELD_FOCUS_QUERY).toBe("(hover: hover) and (pointer: fine)");
    expect(DESKTOP_QUERY).toContain(FIELD_FOCUS_QUERY);
  });
});

describe("tuckedStripRect", () => {
  // The window's untransformed box at 1440x900: bottom edge 108px above the
  // viewport bottom (24 gap + 72 launcher + 12).
  const layout = { x: 976, width: 440, bottom: 792 };

  it("is the 56px band just above the window's resting bottom edge", () => {
    expect(TUCKED_STRIP_PX).toBe(56);
    expect(tuckedStripRect(layout)).toEqual({
      x: 976,
      y: 736,
      width: 440,
      height: 56,
    });
  });

  it("covers a short link inside the band, and not one above it", () => {
    const strip = tuckedStripRect(layout);
    expect(windowObscures({ x: 1100, y: 748, width: 80, height: 24 }, strip)).toBe(
      true,
    );
    expect(windowObscures({ x: 1100, y: 700, width: 80, height: 24 }, strip)).toBe(
      false,
    );
    // Left of the window: clear.
    expect(windowObscures({ x: 600, y: 748, width: 80, height: 24 }, strip)).toBe(
      false,
    );
  });
});
