// The decisions behind the copilot's two hosts, kept free of the DOM so they
// can be tested. On phones, tablets and short screens the copilot is a modal
// dialog; on laptops it is a floating, non-modal window above the launcher.
// Both open and close through the same `open` flag in the chat store; these
// rules say what each host does about it.

/**
 * A fine, hovering pointer: a mouse or trackpad, not a finger. Focusing the
 * field then raises no on-screen keyboard. Part of DESKTOP_QUERY, so a
 * narrow laptop window (which gets the dialog) still counts.
 */
export const FIELD_FOCUS_QUERY = "(hover: hover) and (pointer: fine)";

/**
 * Which screens get the floating window. Touch-first devices (an iPad in
 * landscape is 1024px wide) and short viewports (or 200% zoom) get the modal
 * dialog, which already copes with the on-screen keyboard.
 */
export function desktopHostQuery(): string {
  return `(min-width: 64rem) and ${FIELD_FOCUS_QUERY} and (min-height: 34rem)`;
}

export const DESKTOP_QUERY = desktopHostQuery();

/**
 * Where focus goes when the modal dialog opens. A request for the field is
 * honoured only with a fine pointer: on a touch phone, focusing the field
 * inside the tap raises the keyboard over the starters the visitor came
 * for, so they get the heading. Write intents raised while the dialog is
 * already open (the job-description starter, "wait for the answer") belong
 * to the composer and still focus the field.
 */
export function dialogFocusOnOpen({
  focusRequested,
  finePointer,
}: {
  focusRequested: boolean;
  finePointer: boolean;
}): "field" | "heading" {
  return focusRequested && finePointer ? "field" : "heading";
}

export type FocusTarget = "field" | "heading" | "none";

/**
 * Where focus goes when the copilot changes state. Only the moment of opening
 * matters: a request raised while it is already open belongs to the composer,
 * which is mounted then. A freshly mounted composer ignores the request that
 * opened it, so the host has to do this one itself.
 */
export function focusTargetOnOpen({
  wasOpen,
  isOpen,
  prevFocusRequest,
  focusRequest,
}: {
  wasOpen: boolean;
  isOpen: boolean;
  prevFocusRequest: number;
  focusRequest: number;
}): FocusTarget {
  if (wasOpen || !isOpen) return "none";
  // Opening for an answer focuses the heading, so the visitor lands on what
  // they came to read rather than on an empty field.
  return focusRequest !== prevFocusRequest ? "field" : "heading";
}

/**
 * A focus request that arrives while the laptop window is closed (a prism
 * clicked with a draft waiting, say) means "show me the field", so it opens
 * the window. The phone dialog never opens on its own: it covers the page.
 */
export function opensOnFocusRequest({
  isDesktop,
  isOpen,
  prevFocusRequest,
  focusRequest,
}: {
  isDesktop: boolean;
  isOpen: boolean;
  prevFocusRequest: number;
  focusRequest: number;
}): boolean {
  return isDesktop && !isOpen && focusRequest !== prevFocusRequest;
}

/**
 * Whether leaving for another place (a route change, or a link out of the
 * panel to a section) closes the copilot. The phone dialog would cover the
 * destination; the laptop window is non-modal and stays.
 */
export function shouldCloseOnNavigate(isDesktop: boolean): boolean {
  return !isDesktop;
}

export type ReturnFocus = "opener" | "launcher" | "heroAsk" | "main";

/**
 * Where focus goes back to when the laptop window closes: the control that
 * opened it, else the launcher (always in the page, so this covers an open by
 * the skip link or a deep link), else the hero's ask button, else the main
 * landmark. `canFocus` says whether a candidate is still in the page, visible
 * and outside the window.
 */
export function returnFocusTarget<T>(
  candidates: {
    opener: T | null;
    launcher: T | null;
    heroAsk: T | null;
    main: T | null;
  },
  canFocus: (element: T) => boolean,
): ReturnFocus | null {
  const order: ReturnFocus[] = ["opener", "launcher", "heroAsk", "main"];
  for (const key of order) {
    const element = candidates[key];
    if (element && canFocus(element)) return key;
  }
  return null;
}

/**
 * Escape closes the window, except while an input method is composing (it
 * cancels the candidate there, as when typing Hindi) or when a control inside
 * has already used the key.
 */
export function isCloseKey(event: {
  key: string;
  isComposing: boolean;
  keyCode: number;
  defaultPrevented: boolean;
}): boolean {
  return (
    event.key === "Escape" &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    !event.defaultPrevented
  );
}

/**
 * The window's life: open, then (on close) a short closing phase while its
 * exit animation runs, then closed. Under reduced motion it closes at once.
 * A `done` (animationend, or its timer) only ends a closing phase, so a late
 * one after a quick reopen cannot hide the open window.
 */
export type WindowPhase = "closed" | "open" | "closing";

export type WindowEvent =
  | { type: "open" }
  // handOff: the copilot stays open and moves to the phone dialog, which
  // covers the page, so there is no exit to show.
  | { type: "close"; reduced: boolean; handOff?: boolean }
  | { type: "done" };

export function windowPhase(phase: WindowPhase, event: WindowEvent): WindowPhase {
  switch (event.type) {
    case "open":
      return "open";
    case "close":
      if (phase === "closed") return "closed";
      return event.reduced || event.handOff ? "closed" : "closing";
    case "done":
      return phase === "closing" ? "closed" : phase;
  }
}

/**
 * The close the window gets when it stops showing. With the copilot still
 * open in the store, the screen narrowed and the dialog took over: a hand-off.
 */
export function windowCloseEvent({
  reduced,
  storeOpen,
}: {
  reduced: boolean;
  storeOpen: boolean;
}): Extract<WindowEvent, { type: "close" }> {
  return { type: "close", reduced, handOff: storeOpen };
}

/**
 * What the host does to the native dialog. "hand-off": the screen widened with
 * the dialog open, so the copilot moves to the laptop window. dialog.close()
 * fires the dialog's close event (a task later) either way, and only a plain
 * "hide", or a close by the visitor (Escape, the close button), may close the
 * copilot: see dialogCloseClosesCopilot.
 */
export type DialogSync = "show" | "hide" | "hand-off" | "none";

export function dialogSync({
  showDialog,
  dialogOpen,
  storeOpen,
}: {
  showDialog: boolean;
  dialogOpen: boolean;
  storeOpen: boolean;
}): DialogSync {
  if (showDialog && !dialogOpen) return "show";
  if (!showDialog && dialogOpen) return storeOpen ? "hand-off" : "hide";
  return "none";
}

/**
 * Whether the dialog's close event means the copilot closes. Not for the
 * host's own hand-off close, and not for a stale event that arrives after the
 * dialog was shown again (a quick narrow, widen, narrow).
 */
export function dialogCloseClosesCopilot({
  handingOff,
  dialogOpen,
}: {
  handingOff: boolean;
  dialogOpen: boolean;
}): boolean {
  return !handingOff && !dialogOpen;
}

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Whether the window covers part of a focused element (WCAG 2.4.11 Focus Not
 * Obscured). Edges that only touch do not count, and neither does an
 * element with no box.
 */
export function windowObscures(element: Rect, window: Rect): boolean {
  if (element.width <= 0 || element.height <= 0) return false;
  return (
    element.x < window.x + window.width &&
    element.x + element.width > window.x &&
    element.y < window.y + window.height &&
    element.y + element.height > window.y
  );
}

/** How much of the window stays in view once tucked (copilot-window.css). */
export const TUCKED_STRIP_PX = 56;

/**
 * The band a tucked window still covers: its title strip, which sits just
 * above the window's resting bottom edge (the window slides down and is
 * clipped to that strip). Measured from the untransformed box, so it holds
 * while the tuck is still animating.
 */
export function tuckedStripRect(
  layout: { x: number; width: number; bottom: number },
  strip: number = TUCKED_STRIP_PX,
): Rect {
  return { x: layout.x, y: layout.bottom - strip, width: layout.width, height: strip };
}
