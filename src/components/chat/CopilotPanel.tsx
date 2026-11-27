"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChat, useChatStore } from "@/components/chat/ChatProvider";
import { Composer } from "@/components/chat/Composer";
import { IndexLattice } from "@/components/chat/IndexLattice";
import { NoteDetail } from "@/components/chat/NoteDetail";
import { Thread } from "@/components/chat/Thread";
import { langOf } from "@/lib/lang";
import { NOTE_COUNT } from "@/lib/chat-store";
import {
  getKnowledgeItem,
  jobDescriptionPrompt,
  shortTitle,
  knowledgeBase,
  profile,
  starterQuestions,
} from "@/lib/knowledge";

function Starters() {
  const store = useChatStore();

  return (
    <div>
      <p className="text-[15px] leading-[1.4] text-muted">
        <span className="lg:hidden">Start with one of these, or write your own.</span>
        <span className="max-lg:hidden">
          Hover a question to see which notes it would pull.
        </span>
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {starterQuestions.map(({ question, lang }) => (
          <li key={question}>
            <button
              type="button"
              lang={lang}
              onMouseEnter={() => store.setPreview(question)}
              onMouseLeave={() => store.setPreview(null)}
              onFocus={() => store.setPreview(question)}
              onBlur={() => store.setPreview(null)}
              onClick={() => void store.ask(question)}
              className="tap w-full rounded-md border border-control px-3 py-2 text-left text-[16px] leading-[1.3] text-ink hover:border-ink"
            >
              {question}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => {
              store.setDraft(jobDescriptionPrompt);
              store.requestFocus();
            }}
            className="tap w-full rounded-md border border-dashed border-control px-3 py-2 text-left text-[16px] leading-[1.3] text-ink hover:border-ink"
          >
            Paste a job description to compare him against it
          </button>
        </li>
      </ul>
    </div>
  );
}

export function CopilotPanel({
  inDialog = false,
}: Readonly<{ inDialog?: boolean }>) {
  const store = useChatStore();
  const hasThread = useChat((state) => state.messages.length > 0);
  const questionCount = useChat(
    (state) =>
      state.messages.filter((message) => message.kind === "question").length,
  );
  const busy = useChat((state) => state.status !== "idle");
  const announcement = useChat((state) => state.announcement);
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);

  // The phone dialog starts with the compact strip, so the questions and the
  // field fit on a small screen; the docked column has room for the full one.
  const full = inDialog ? expanded : !hasThread || expanded;
  const selected = selectedId ? getKnowledgeItem(selectedId) : undefined;
  const titleId = inDialog ? "copilot-title-dialog" : "copilot-title";

  // A new question is brought to the top of the thread and the answer then
  // streams in below it. The view never chases the text, and the page itself
  // never scrolls on its own.
  useEffect(() => {
    const thread = threadRef.current;
    const tail = tailRef.current;
    if (!thread || !tail) return;
    if (questionCount === 0) {
      tail.style.height = "0px";
      thread.scrollTop = 0;
      return;
    }
    const questions = thread.querySelectorAll<HTMLElement>("[data-question]");
    const latest = questions[questions.length - 1];
    if (!latest) return;
    const target = Math.max(0, latest.offsetTop - thread.offsetTop - 12);
    // Reserve room below the new turn so it can sit at the top even before
    // its answer has filled the panel.
    const below = thread.scrollHeight - tail.offsetHeight - target;
    tail.style.height = `${Math.max(0, thread.clientHeight - below)}px`;
    thread.scrollTop = target;
    // A control that sent the question may have been removed (a starter or a
    // follow-up); keep keyboard focus in the copilot instead of losing it.
    if (document.activeElement === document.body) {
      latest.querySelector<HTMLElement>("[tabindex]")?.focus({ preventScroll: true });
    }
  }, [questionCount]);

  return (
    <section className="copilot-panel" aria-labelledby={titleId}>
      <header className="px-4 pt-3 lg:px-6 lg:pt-5">
        <div className="flex items-center gap-1">
          <h2
            id={titleId}
            tabIndex={-1}
            className="flex-1 text-[20px] font-bold leading-tight [font-stretch:85%] focus:outline-none"
          >
            Ask about Bhanu
          </h2>
          {hasThread ? (
            <button
              type="button"
              onClick={() => {
                store.reset();
                store.requestFocus();
                setExpanded(false);
                setSelectedId(null);
              }}
              className="tap inline-flex items-center gap-1.5 rounded-md px-2 text-[14px] text-muted hover:text-ink"
            >
              <RotateCcw size={15} aria-hidden="true" />
              New chat
            </button>
          ) : null}
          {inDialog ? (
            <button
              type="button"
              onClick={() => store.close()}
              aria-label="Close the copilot"
              className="tap-square -mr-2 inline-flex items-center justify-center rounded-md text-ink"
            >
              <X size={22} aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div className="mt-3">
          <IndexLattice
            size={full ? "full" : "strip"}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
          />
          <div className="flex flex-wrap items-center gap-x-4">
            {hasThread || inDialog ? (
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
                className="tap inline-flex items-center gap-1 text-[14px] text-muted hover:text-ink"
              >
                {expanded ? (
                  <ChevronUp size={15} aria-hidden="true" />
                ) : (
                  <ChevronDown size={15} aria-hidden="true" />
                )}
                {expanded ? "Shrink the index" : "Expand the index"}
              </button>
            ) : null}
            {full ? (
              <button
                type="button"
                aria-expanded={browsing}
                aria-controls="note-list"
                onClick={() => setBrowsing(!browsing)}
                className="tap inline-flex items-center gap-1 text-[14px] text-muted hover:text-ink"
              >
                {browsing ? (
                  <ChevronUp size={15} aria-hidden="true" />
                ) : (
                  <ChevronDown size={15} aria-hidden="true" />
                )}
                {browsing ? "Hide the list" : `List all ${NOTE_COUNT} notes`}
              </button>
            ) : null}
            <Link
              href="/#how"
              onClick={() => store.close()}
              className="link tap ml-auto inline-flex items-center text-[14px] text-muted"
            >
              Keyword match, not embeddings
            </Link>
          </div>
          {full && browsing ? (
            <ul
              id="note-list"
              className="mb-2 grid max-h-44 grid-cols-2 gap-x-3 overflow-y-auto border-t border-hairline pt-2 text-[14px] leading-[1.3]"
            >
              {knowledgeBase.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selectedId === item.id}
                    onClick={() =>
                      setSelectedId(item.id === selectedId ? null : item.id)
                    }
                    className={`min-h-9 w-full py-1.5 text-left hover:text-ink ${
                      selectedId === item.id
                        ? "font-semibold text-ink"
                        : "text-muted"
                    }`}
                  >
                    {shortTitle(item)}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selected ? (
            <div className="mb-3">
              <NoteDetail item={selected} onClose={() => setSelectedId(null)} />
            </div>
          ) : null}
        </div>
        <div className="stream-bar -mx-4 lg:-mx-6" data-active={busy} />
      </header>

      <div
        ref={threadRef}
        className="thread px-4 py-4 lg:px-6"
      >
        {hasThread ? <Thread /> : <Starters />}
        <div ref={tailRef} aria-hidden="true" />
      </div>

      <footer className="border-t border-hairline px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:px-6">
        <Composer />
        <p className="mt-2 text-[13px] leading-[1.4] text-muted">
          AI-written, so{" "}
          <a href={profile.resumePath} className="link">
            check it against the résumé
          </a>
          .
        </p>
      </footer>

      <p role="status" className="sr-only" lang={langOf(announcement)}>
        {announcement}
      </p>
    </section>
  );
}
