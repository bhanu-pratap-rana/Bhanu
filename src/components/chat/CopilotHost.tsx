"use client";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type AnimationEvent,
  type KeyboardEvent,
} from "react";
import {
  useChat,
  useChatStore,
  useIsDesktop,
} from "@/components/chat/ChatProvider";
import { CopilotLauncher } from "@/components/chat/CopilotLauncher";
import { CopilotPanel } from "@/components/chat/CopilotPanel";
import { useSceneBus } from "@/components/scene/scene-bus";
import {
  FIELD_FOCUS_QUERY,
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
  type ReturnFocus,
  type WindowPhase,
} from "@/lib/copilot-host";
import { langOf } from "@/lib/lang";

/** The window's exit animation, plus a margin in case animationend is lost. */
const CLOSING_FALLBACK_MS = 260;

/**
 * The polite live region for the copilot. It must exist before its text
 * changes, so it lives here and not in the panel, which both hosts mount only
 * while the copilot is open.
 */
function Announcer({ text }: Readonly<{ text: string }>) {
  return (
    <p role="status" className="sr-only" lang={langOf(text)}>
      {text}
    </p>
  );
}

/** Still in the page, rendered, and not inside the window that is closing. */
function canTakeFocus(element: HTMLElement, win: HTMLElement | null) {
  if (!element.isConnected || element === document.body) return false;
  if (win?.contains(element) || element.closest("[inert]")) return false;
  return typeof element.checkVisibility === "function"
    ? element.checkVisibility()
    : element.getClientRects().length > 0;
}

function findReturnFocus(
  opener: HTMLElement | null,
  launcher: HTMLElement | null,
  win: HTMLElement | null,
): HTMLElement | null {
  const candidates: Record<ReturnFocus, HTMLElement | null> = {
    opener,
    launcher,
    heroAsk: document.querySelector<HTMLElement>("#hero-ask button"),
    main: document.getElementById("main"),
  };
  const kind = returnFocusTarget(candidates, (element) =>
    canTakeFocus(element, win),
  );
  return kind ? candidates[kind] : null;
}

type WindowLife = { shown: boolean; phase: WindowPhase };

const endClosing = (life: WindowLife): WindowLife => ({
  ...life,
  phase: windowPhase(life.phase, { type: "done" }),
});

function boxOf(element: Element) {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
}

/**
 * The tucked window's strip, from its resting box: the transform that tucks
 * it may still be running, but its `bottom` and horizontal extent do not move.
 */
function tuckedStripOf(win: HTMLElement) {
  const { x, width } = win.getBoundingClientRect();
  const bottom =
    document.documentElement.clientHeight -
    Number.parseFloat(getComputedStyle(win).bottom);
  return tuckedStripRect({ x, width, bottom });
}

/**
 * One panel, two hosts. On laptops it is a floating, non-modal window above
 * the launcher: the page stays readable and usable while an answer streams.
 * On phones, tablets and short screens it is a native modal dialog, which
 * brings the focus trap, Escape, the top layer and an inert page for free.
 * Chat state lives in the store, so nothing is lost when the host swaps or
 * the copilot closes.
 */
export function CopilotHost() {
  const store = useChatStore();
  const isDesktop = useIsDesktop();
  const open = useChat((state) => state.open);
  const focusRequest = useChat((state) => state.focusRequest);
  const announcement = useChat((state) => state.announcement);
  const reduced = useSceneBus((s) => s.reduced);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const handledFocus = useRef(focusRequest);
  // Set while the host closes the dialog itself to hand the copilot to the
  // laptop window, so the close event that follows leaves the store open.
  const handingOff = useRef(false);
  const pathname = usePathname();
  const showDialog = !isDesktop && open;
  const showWindow = isDesktop && open;

  const windowRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const windowWasOpen = useRef(false);
  const windowFocus = useRef(focusRequest);
  // The control that opened the window, so closing it can hand focus back.
  const opener = useRef<HTMLElement | null>(null);

  // The window's phase follows `showWindow`, with a closing phase in between
  // so the exit can animate. Adjusted while rendering (not in an effect), so
  // the panel is mounted in the same commit that opens the window and the
  // focus effect below finds its field.
  const [life, setLife] = useState<WindowLife>({
    shown: showWindow,
    phase: showWindow ? "open" : "closed",
  });
  // Tucked: shrunk to its title strip because page focus went under it.
  const [tucked, setTucked] = useState(false);
  if (life.shown !== showWindow) {
    setLife({
      shown: showWindow,
      phase: windowPhase(
        life.phase,
        showWindow
          ? { type: "open" }
          : windowCloseEvent({ reduced, storeOpen: open }),
      ),
    });
    setTucked(false);
  }
  const phase = life.phase;
  const finishClosing = () => setLife(endClosing);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = window.setTimeout(() => setLife(endClosing), CLOSING_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // A layout effect, so the dialog is open (and laid out) before the panel's
  // own effects run: they scroll the thread and need real sizes.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const sync = dialogSync({
      showDialog,
      dialogOpen: dialog.open,
      storeOpen: open,
    });
    if (sync === "show") {
      handingOff.current = false;
      dialog.showModal();
      // Opening for an answer, or by touch, focuses the heading, not the
      // field, so the phone keyboard does not cover what the visitor came to
      // read (the starters, or the answer).
      const target =
        dialogFocusOnOpen({
          focusRequested: focusRequest !== handledFocus.current,
          finePointer: window.matchMedia(FIELD_FOCUS_QUERY).matches,
        }) === "field"
          ? dialog.querySelector<HTMLTextAreaElement>("#copilot-input")
          : dialog.querySelector<HTMLElement>("#copilot-title-dialog");
      target?.focus({ preventScroll: true });
    }
    if (sync === "hide" || sync === "hand-off") {
      // close() fires the dialog's close event a task later; a hand-off
      // (the screen widened, the copilot moves to the window) must not let
      // that event close the copilot.
      handingOff.current = sync === "hand-off";
      dialog.close();
    }
    handledFocus.current = focusRequest;
  }, [showDialog, focusRequest, open]);

  function onDialogClose() {
    const closes = dialogCloseClosesCopilot({
      handingOff: handingOff.current,
      dialogOpen: dialogRef.current?.open ?? false,
    });
    handingOff.current = false;
    if (closes) store.close();
  }

  // The laptop window gets the same focus care the dialog has natively: in
  // on open, and back to where the visitor was on close.
  useLayoutEffect(() => {
    if (!isDesktop) {
      // The dialog owns focus on phones. Keep this bookkeeping current so a
      // later widening does not act on a request that was already handled.
      windowWasOpen.current = false;
      windowFocus.current = focusRequest;
      return;
    }
    if (
      opensOnFocusRequest({
        isDesktop,
        isOpen: open,
        prevFocusRequest: windowFocus.current,
        focusRequest,
      })
    ) {
      // Leave the request unhandled: the render that opens the window sees
      // it and puts the caret in the field.
      store.open();
      return;
    }

    const win = windowRef.current;
    const wasOpen = windowWasOpen.current;
    const target = focusTargetOnOpen({
      wasOpen,
      isOpen: open,
      prevFocusRequest: windowFocus.current,
      focusRequest,
    });
    if (target !== "none") {
      const active = document.activeElement;
      opener.current =
        active instanceof HTMLElement &&
        active !== document.body &&
        !win?.contains(active)
          ? active
          : null;
    }
    if (target === "field") {
      const input = win?.querySelector<HTMLTextAreaElement>("#copilot-input");
      input?.focus({ preventScroll: true });
      input?.setSelectionRange(input.value.length, input.value.length);
    } else if (target === "heading") {
      win
        ?.querySelector<HTMLElement>("#copilot-title")
        ?.focus({ preventScroll: true });
    }

    if (wasOpen && !open) {
      // Closed some other way than the window's own controls, with focus
      // inside: the window is going inert and focus would drop to the page.
      const active = document.activeElement;
      if (!active || active === document.body || win?.contains(active)) {
        findReturnFocus(opener.current, launcherRef.current, win)?.focus({
          preventScroll: true,
        });
      }
      opener.current = null;
    }

    windowWasOpen.current = open;
    windowFocus.current = focusRequest;
  }, [isDesktop, open, focusRequest, store]);

  // Focus Not Obscured (WCAG 2.4.11): the window is non-modal, so Tab can
  // walk the page behind it. When focus lands on something it covers, it
  // tucks down to its title strip; focus back inside (or the launcher)
  // brings it up again.
  useEffect(() => {
    if (phase !== "open") return;
    let frame = 0;
    const onFocusIn = (event: FocusEvent) => {
      const win = windowRef.current;
      const target = event.target;
      if (!win || !(target instanceof Element)) return;
      if (win.contains(target)) {
        setTucked(false);
        return;
      }
      if (launcherRef.current?.contains(target)) return;
      if (win.dataset.tucked !== "true") {
        if (!windowObscures(boxOf(target), boxOf(win))) return;
        setTucked(true);
      }
      // Tucked (or tucking), the strip still covers a band of the page, and
      // the browser only scrolls focus that is off screen. Checked a frame
      // later, after the browser's own focus scroll; the raised
      // scroll-padding (copilot-window.css) makes "nearest" clear the strip.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Keyboard focus only: a click already hit the visible part.
        if (document.activeElement !== target) return;
        if (!target.matches(":focus-visible")) return;
        if (windowObscures(boxOf(target), tuckedStripOf(win))) {
          target.scrollIntoView({
            block: "nearest",
            behavior: reduced ? "auto" : "smooth",
          });
        }
      });
    };
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      cancelAnimationFrame(frame);
    };
  }, [phase, reduced]);

  // Focus leaves the window before it goes inert, so it never drops to the
  // page body in between. preventScroll: the opener may be far up the page
  // (the hero CTA), and closing must not jump the page there.
  function closeWindow() {
    const win = windowRef.current;
    const active = document.activeElement;
    if (win && active && win.contains(active)) {
      findReturnFocus(opener.current, launcherRef.current, win)?.focus({
        preventScroll: true,
      });
    }
    store.close();
  }

  function onLauncherPress() {
    if (showWindow) {
      // A tucked window comes back up first; a second press closes it.
      if (tucked) setTucked(false);
      else closeWindow();
      return;
    }
    const hasThread = store.getState().messages.length > 0;
    store.open({ focus: !hasThread });
  }

  // Escape works anywhere in the window and on the launcher (where focus
  // sits after opening by pointer or tabbing out of the window).
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!showWindow) return;
    if (
      !isCloseKey({
        key: event.key,
        isComposing: event.nativeEvent.isComposing,
        keyCode: event.keyCode,
        defaultPrevented: event.defaultPrevented,
      })
    ) {
      return;
    }
    event.preventDefault();
    closeWindow();
  }

  function onWindowAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && phase === "closing") {
      finishClosing();
    }
  }

  // Following a link out of the dialog (to a section or a project page) must
  // not leave it covering the destination. The laptop window is non-modal,
  // so it stays open across navigation.
  const closeOnNavigate = useEffectEvent(() => {
    if (shouldCloseOnNavigate(isDesktop)) store.close();
  });
  useEffect(() => {
    closeOnNavigate();
  }, [pathname]);

  // Two copies of one region, never both in the accessibility tree: a modal
  // dialog makes everything outside it inert, which silences the outer copy,
  // and a closed dialog is display: none, which silences the inner one. So
  // each announcement is heard exactly once, whether the dialog is open,
  // closed, or (on laptops) never used.
  return (
    <>
      {/* Window first, launcher right after it: Tab from the composer lands
          on the launcher, and the order matches the picture (window above
          launcher). One key handler covers both. */}
      <div className="copilot-host" onKeyDown={onKeyDown}>
        <div
          ref={windowRef}
          id="copilot"
          role="dialog"
          aria-modal="false"
          aria-labelledby="copilot-title"
          className="copilot-window"
          data-state={phase}
          data-tucked={tucked && phase === "open" ? "true" : undefined}
          hidden={phase === "closed"}
          inert={phase !== "open"}
          onAnimationEnd={onWindowAnimationEnd}
          onPointerDown={tucked ? () => setTucked(false) : undefined}
        >
          {/* Mounted only while open (and closing): reopening lands the
              thread on its latest question again, and the draft is kept in
              the store. */}
          {phase !== "closed" ? <CopilotPanel onClose={closeWindow} /> : null}
        </div>
        <CopilotLauncher
          buttonRef={launcherRef}
          controlsId={isDesktop ? "copilot" : "copilot-dialog"}
          expanded={open}
          onPress={onLauncherPress}
        />
      </div>
      <Announcer text={announcement} />
      <dialog
        ref={dialogRef}
        id="copilot-dialog"
        className="copilot-dialog"
        aria-labelledby="copilot-title-dialog"
        onClose={onDialogClose}
      >
        {showDialog ? <CopilotPanel inDialog /> : null}
        <Announcer text={announcement} />
      </dialog>
    </>
  );
}
