"use client";

import type { ReactNode } from "react";
import { useChatStore } from "@/components/chat/ChatProvider";
import type { ChatMode } from "@/lib/rag";

/**
 * Sends one question to the copilot from anywhere on the page. On a phone it
 * also opens the dialog, so the answer appears over the place you asked from.
 */
export function AskButton({
  question,
  mode,
  label,
  className,
  children,
}: Readonly<{
  question: string;
  mode?: ChatMode;
  /** Accessible name; must start with the visible text. */
  label?: string;
  className?: string;
  children: ReactNode;
}>) {
  const store = useChatStore();

  return (
    <button
      type="button"
      aria-label={label}
      className={className ?? "link tap inline-flex items-center text-left"}
      onClick={() => {
        store.open();
        void store.ask(question, { mode });
      }}
    >
      {children}
    </button>
  );
}
