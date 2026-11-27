"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import {
  useChat,
  useChatStore,
  useIsDesktop,
} from "@/components/chat/ChatProvider";
import { CopilotPanel } from "@/components/chat/CopilotPanel";

/**
 * One panel, two hosts. On wide screens it is a docked column that is always
 * there. On phones it is a native modal dialog, which brings the focus trap,
 * Escape, the top layer and an inert page for free instead of hand-rolling
 * them. Chat state lives in the store, so nothing is lost when the host swaps.
 */
export function CopilotHost() {
  const store = useChatStore();
  const isDesktop = useIsDesktop();
  const open = useChat((state) => state.open);
  const focusRequest = useChat((state) => state.focusRequest);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const handledFocus = useRef(focusRequest);
  const pathname = usePathname();
  const showDialog = !isDesktop && open;

  // A layout effect, so the dialog is open (and laid out) before the panel's
  // own effects run: they scroll the thread and need real sizes.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (showDialog && !dialog.open) {
      dialog.showModal();
      const wantsField = focusRequest !== handledFocus.current;
      const target = wantsField
        ? dialog.querySelector<HTMLTextAreaElement>("#copilot-input")
        : dialog.querySelector<HTMLElement>("#copilot-title-dialog");
      // Opening for an answer focuses the heading, not the field, so the
      // phone keyboard does not cover what the visitor came to read.
      target?.focus({ preventScroll: true });
    }
    if (!showDialog && dialog.open) dialog.close();
    handledFocus.current = focusRequest;
  }, [showDialog, focusRequest]);

  // The open flag only means something for the phone dialog. Clearing it on
  // wide screens stops a later resize or rotation from opening a modal.
  useEffect(() => {
    if (isDesktop && open) store.close();
  }, [isDesktop, open, store]);

  // Following a link out of the dialog (to a section or a project page)
  // must not leave it covering the destination.
  useEffect(() => {
    store.close();
  }, [pathname, store]);

  return (
    <>
      <aside id="copilot" className="copilot-aside" aria-label="Copilot">
        {isDesktop ? <CopilotPanel /> : null}
      </aside>
      <dialog
        ref={dialogRef}
        className="copilot-dialog"
        aria-labelledby="copilot-title-dialog"
        onClose={() => store.close()}
      >
        {showDialog ? <CopilotPanel inDialog /> : null}
      </dialog>
    </>
  );
}
