"use client";

import { ArrowUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useChat, useChatStore } from "@/components/chat/ChatProvider";

/**
 * Phone only: once the hero's ask field has scrolled away, one button keeps
 * the copilot within reach of the thumb. It is a button, not a field, because
 * a fixed field would end up hidden behind the keyboard.
 */
export function AskBar() {
  const store = useChatStore();
  const busy = useChat((state) => state.status !== "idle");
  const hasThread = useChat((state) => state.messages.length > 0);
  const [heroVisible, setHeroVisible] = useState(true);
  const pathname = usePathname();

  // Re-attached on every navigation: this bar lives in the layout, but each
  // page brings its own hero (or none).
  useEffect(() => {
    const hero = document.getElementById("hero-ask");
    // Pages without a hero field (project pages) show the bar from the start.
    if (!hero) {
      const frame = requestAnimationFrame(() => setHeroVisible(false));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) =>
      setHeroVisible(entry.isIntersecting),
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [pathname]);

  // Not hidden while the dialog is open: the modal already makes the page
  // inert, and Escape must be able to return focus to this button.
  const shown = !heroVisible;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-ground px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 transition-[translate,opacity] duration-200 data-[shown=false]:invisible data-[shown=false]:translate-y-4 data-[shown=false]:opacity-0 lg:hidden [@media(max-height:480px)]:hidden"
      data-shown={shown}
    >
      <button
        type="button"
        tabIndex={shown ? 0 : -1}
        onClick={() => store.open({ focus: !hasThread })}
        className="tap pointer-events-auto mx-auto flex w-full max-w-md items-center gap-3 rounded-md border border-control bg-surface py-2 pl-4 pr-2 text-left text-[16px] text-ink"
      >
        <span className="min-w-0 flex-1 truncate">
          {busy
            ? "Answering…"
            : hasThread
              ? "View the answer, or ask again"
              : "Ask about Bhanu’s work…"}
        </span>
        <span
          aria-hidden="true"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-ground"
        >
          <ArrowUp size={18} />
        </span>
      </button>
    </div>
  );
}
