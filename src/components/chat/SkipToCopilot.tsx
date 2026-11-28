"use client";

import type { MouseEvent } from "react";
import { useChatStore } from "@/components/chat/ChatProvider";

/**
 * Laptop only. The column is closed by default, so a plain `#copilot` link
 * would land on nothing: this opens it, and the host then focuses the panel
 * heading. Already open, it focuses the heading itself.
 */
export function SkipToCopilot() {
  const store = useChatStore();

  function skip(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (store.getState().open) {
      document
        .querySelector<HTMLElement>("#copilot #copilot-title")
        ?.focus({ preventScroll: true });
      return;
    }
    store.open();
  }

  return (
    <a
      href="#copilot"
      onClick={skip}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-16 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-[15px] focus:text-ground max-lg:hidden"
    >
      Skip to the copilot
    </a>
  );
}
