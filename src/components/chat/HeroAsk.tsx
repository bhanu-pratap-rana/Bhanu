"use client";

import { ArrowUp } from "lucide-react";
import { useChat, useChatStore } from "@/components/chat/ChatProvider";
import { starterQuestions } from "@/lib/knowledge";

/**
 * The phone's way into the copilot. It looks like the composer but is a
 * button: the real field lives in the dialog, where it stays above the
 * keyboard. Hidden on wide screens, where the docked column is always there.
 */
export function HeroAsk() {
  const store = useChatStore();
  const draft = useChat((state) => state.draft);
  const hasThread = useChat((state) => state.messages.length > 0);

  return (
    <div id="hero-ask" className="lg:hidden">
      <button
        type="button"
        onClick={() => store.open({ focus: true })}
        className={`tap flex w-full items-center gap-3 rounded-md border border-control bg-surface/80 py-2 pl-3 backdrop-blur-sm pr-2 text-left text-[16px] ${draft.trim() ? "text-ink" : "text-muted"}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {draft.trim()
            ? draft
            : hasThread
              ? "Continue the conversation…"
              : "Ask about Bhanu’s work…"}
        </span>
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-ground"
        >
          <ArrowUp size={18} />
        </span>
      </button>
      <ul className="mt-2 flex flex-col gap-2">
        {starterQuestions.slice(0, 2).map(({ question, lang }) => (
          <li key={question}>
            <button
              type="button"
              lang={lang}
              onClick={() => {
                store.open();
                void store.ask(question);
              }}
              className="tap w-full rounded-md border border-hairline bg-ground/60 px-3 py-2 text-left text-[16px] leading-[1.35] text-ink"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
