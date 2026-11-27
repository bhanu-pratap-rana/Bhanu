"use client";

import { ArrowRight } from "lucide-react";
import { useChatStore } from "@/components/chat/ChatProvider";

/** Wide screens: the copilot is docked beside the page; this puts the cursor in it. */
export function FocusCopilotButton() {
  const store = useChatStore();
  return (
    <button
      type="button"
      onClick={() => store.requestFocus()}
      className="tap inline-flex items-center gap-2 rounded-md bg-ink px-4 font-semibold text-ground hover:bg-ink/90"
    >
      Ask the copilot
      <ArrowRight size={17} aria-hidden="true" className="max-lg:hidden" />
    </button>
  );
}
