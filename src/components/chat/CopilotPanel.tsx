"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChat, useChatStore } from "@/components/chat/ChatProvider";
import { Composer } from "@/components/chat/Composer";
import { IndexLattice } from "@/components/chat/IndexLattice";
import { NoteDetail } from "@/components/chat/NoteDetail";
import { Thread } from "@/components/chat/Thread";
import { HexPortrait } from "@/components/site/HexPortrait";
import { coreCanDock, useSceneBus } from "@/components/scene/scene-bus";
import { NOTE_COUNT } from "@/lib/chat-store";
import {
  getKnowledgeItem,
  jobDescriptionPrompt,
  shortTitle,
  knowledgeBase,
  panelStarters,
  profile,
} from "@/lib/knowledge";

function Starters() {
  const store = useChatStore();
  // One list, in knowledge.ts's order: the recruiter's shortcut sits at
  // JOB_DESCRIPTION_STARTER_INDEX, solid so it is never missed.
  return (
    <div>
      <p className="text-[15px] leading-[1.4] text-muted">
        Pick a question or ask your own.
      </p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {panelStarters().map((entry) =>
          entry.kind === "job-description" ? (
            <li key="job-description">
              <button
                type="button"
                onClick={() => {
                  store.setDraft(jobDescriptionPrompt);
                  store.requestFocus();
                }}
                className="tap w-full rounded-md border border-ink bg-ink px-3 py-2 text-left text-[16px] font-semibold leading-[1.3] text-ground hover:opacity-90"
              >
                Recruiter? Paste a job description
              </button>
            </li>
          ) : (
            <li key={entry.question}>
              <button
                type="button"
                lang={entry.lang}
                // Hover and focus preview the notes a question would read in the
                // dock; the visitor is never told to hover (touch has none).
                onMouseEnter={() => store.setPreview(entry.question)}
                onMouseLeave={() => store.setPreview(null)}
                onFocus={() => store.setPreview(entry.question)}
                onBlur={() => store.setPreview(null)}
                onClick={() => void store.ask(entry.question)}
                className="tap w-full rounded-md border border-control px-3 py-2 text-left text-[16px] leading-[1.3] text-ink hover:border-ink"
              >
                {entry.question}
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

export function CopilotPanel({
  inDialog = false,
  onClose,
}: Readonly<{
  inDialog?: boolean;
  /** The laptop window's close, which hands focus back before it goes. */
  onClose?: () => void;
}>) {
  const store = useChatStore();
  const hasThread = useChat((state) => state.messages.length > 0);
  const questionCount = useChat(
    (state) =>
      state.messages.filter((message) => message.kind === "question").length,
  );
  const busy = useChat((state) => state.status !== "idle");
  // The 3D core can fly into the window's dock (booted and its GPU context
  // alive); otherwise, and always in the phone dialog, the 2D lattice.
  const coreDocks = useSceneBus((s) => coreCanDock(s.core)) && !inDialog;
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLDivElement>(null);

  // Both hosts start with the compact strip, so the questions and the field
  // fit (the laptop window at 1280x720 too); "Show the notes" grows it.
  const full = expanded;
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
    // Only for a question asked just now: a thread restored on page load must
    // not pull focus into the copilot before the visitor has done anything.
    if (
      store.getState().status !== "idle" &&
      document.activeElement === document.body
    ) {
      latest.querySelector<HTMLElement>("[tabindex]")?.focus({ preventScroll: true });
    }
  }, [questionCount, store]);

  // The laptop window is itself the labelled dialog, so a plain box here;
  // the phone dialog keeps its labelled section.
  const Root = inDialog ? "section" : "div";
  const pad = inDialog ? "px-4" : "px-5";
  const lattice = (
    <IndexLattice
      size={full ? "full" : "strip"}
      selectedId={selectedId}
      onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
    />
  );

  return (
    <Root
      className="copilot-panel"
      aria-labelledby={inDialog ? titleId : undefined}
    >
      {/* In the window the title row fits the 56px strip it tucks down to.
          Header and footer never scroll away: the thread is the scroller. */}
      <header className={`copilot-panel-head ${pad} ${inDialog ? "pt-3" : "pt-1.5"}`}>
        <div className="flex min-h-11 items-center gap-1">
          {/* Decorative: the title says whose copilot this is. */}
          <HexPortrait size={32} fit="crop" alt="" className="copilot-avatar" />
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              tabIndex={-1}
              className="text-[20px] font-bold leading-tight focus:outline-none"
            >
              Bhanu’s copilot
            </h2>
            <p className="text-[13px] leading-[1.35] text-muted">
              Reads {NOTE_COUNT} notes about Bhanu’s work
            </p>
          </div>
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
          {/* Both hosts close here; the launcher and Escape close too. */}
          <button
            type="button"
            onClick={() => (onClose ? onClose() : store.close())}
            aria-label="Close the copilot"
            className="tap-square -mr-2 inline-flex items-center justify-center rounded-md text-ink"
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3">
          {inDialog ? (
            lattice
          ) : (
            // The dock. With the 3D core the empty box is where it flies in
            // and lights what the copilot reads (MemoryCore measures
            // [data-core-dock] every frame and draws over it); the lattice
            // then keeps only its caption, beside the core. Without it, the
            // 2D lattice. Pointing at a prism names its note; clicking asks.
            <div
              className="copilot-dock"
              data-size={full ? "full" : "strip"}
              data-core={coreDocks ? "3d" : "2d"}
            >
              {coreDocks ? (
                <div
                  className="copilot-dock-space"
                  data-core-dock=""
                  data-core-hit=""
                  aria-hidden="true"
                />
              ) : null}
              {lattice}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4">
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
              {hasThread
                ? expanded
                  ? "Hide the sources"
                  : "Show the sources"
                : expanded
                  ? "Hide the notes"
                  : "Show the notes"}
            </button>
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
              // Only the phone dialog would cover the section; the laptop
              // window is non-modal and stays.
              onClick={inDialog ? () => store.close() : undefined}
              className="link tap ml-auto inline-flex items-center text-[14px] text-muted"
            >
              How it works
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
        <div
          className={`stream-bar ${inDialog ? "-mx-4" : "-mx-5"}`}
          data-active={busy}
        />
      </header>

      <div ref={threadRef} className={`thread ${pad} py-4`}>
        {hasThread ? <Thread /> : <Starters />}
        <div ref={tailRef} aria-hidden="true" />
      </div>

      <footer
        className={`border-t border-hairline ${pad} pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3`}
      >
        <Composer />
        <p className="mt-2 text-[13px] leading-[1.4] text-muted">
          AI-written, so{" "}
          <a href={profile.resumePath} className="link">
            check it against the resume
          </a>
          .
        </p>
      </footer>
    </Root>
  );
}
