"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useChat, useChatStore } from "@/components/chat/ChatProvider";
import { useIndexView } from "@/components/chat/IndexLattice";
import { captionFor } from "@/lib/index-caption";
import { DEMO } from "@/components/scene/MemoryCore";
import { PAUSE_KEY, sceneBus, useSceneBus } from "@/components/scene/scene-bus";
import { NOTE_COUNT } from "@/lib/chat-store";
import { starterQuestions } from "@/lib/knowledge";

const STEP_MS = 4200;

/**
 * The line under the hero's call to action that says what the core is
 * showing. Before anything is asked it plays the starter questions through
 * the real retriever, and the line is a one-tap starter: pressing it opens
 * the copilot and asks that question. Once the visitor types or asks, it
 * follows them instead and is plain text.
 */
export function HeroLive() {
  const store = useChatStore();
  const { view, busy } = useIndexView();
  const demo = useSceneBus((s) => s.demo);
  const paused = useSceneBus((s) => s.paused);
  const reduced = useSceneBus((s) => s.reduced);
  const coreOn = useSceneBus((s) => s.core === "on");
  const heroInView = useSceneBus((s) => s.heroInView);
  const hasThread = useChat((state) => state.messages.length > 0);
  // The open panel carries its own caption; repeating it here is noise.
  const panelOpen = useChat((state) => state.open);
  // Pointer over or focus on the starter: hold its question still, so what
  // is pressed is what was read. Tracked apart, so a pointer passing over a
  // focused starter does not set it rotating under a keyboard user.
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const held = hovered || focused;
  const countId = useId();
  const resting = view.phase === "rest";
  const still = paused || reduced;
  // The demo question changes by rolling: the new line slides up into the
  // starter fully opaque while the old one slides out above it, fading out
  // in the first ~80ms so two questions are never both legible (hero.css).
  // `leaving` is the question rolling out, kept until its animation ends.
  // Derived during render (React's "storing information from previous renders").
  const [roll, setRoll] = useState<{ shown: number; leaving: number | null }>({
    shown: demo,
    leaving: null,
  });
  if (roll.shown !== demo) {
    setRoll({ shown: demo, leaving: still ? null : roll.shown });
  }
  const leaving = still ? null : roll.leaving;

  // On the bus, not local: the core also stops showing the demo off screen.
  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;
    const observer = new IntersectionObserver(([entry]) =>
      sceneBus.set({ heroInView: entry.isIntersecting }),
    );
    observer.observe(hero);
    return () => {
      observer.disconnect();
      // Leaving the page must not leave the next hero marked off screen.
      sceneBus.set({ heroInView: true });
    };
  }, []);

  useEffect(() => {
    if (!resting || paused || reduced || !heroInView || held) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      sceneBus.set({ demo: (sceneBus.get().demo + 1) % DEMO.length });
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [resting, paused, reduced, heroInView, held]);

  function togglePause() {
    const next = !paused;
    sceneBus.set({ paused: next });
    try {
      localStorage.setItem(PAUSE_KEY, next ? "1" : "0");
    } catch {
      /* lasts for this visit */
    }
  }

  const frame = DEMO[demo % DEMO.length];
  const mark = (
    <span
      className="hero-live-mark"
      aria-hidden="true"
      data-lit={!resting || frame.count > 0}
      data-still={still ? "true" : undefined}
    />
  );

  return (
    <div className="hero-live">
      {resting ? (
        // The question changes every few seconds, so it is not a live region;
        // the name is read when the button is reached, and holds still then.
        // Named by its content (no aria-label), so the name is exactly the
        // visible "Ask: <question>": the quote marks are hidden from it and
        // the count is its description, not part of the name.
        <button
          type="button"
          className="hero-live-line hero-live-ask"
          aria-describedby={countId}
          onClick={() => {
            store.open();
            void store.ask(frame.question);
          }}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        >
          {mark}
          {/* Two lines stacked in one cell: the question rolling out (hidden
              from the name) and the one rolling in. */}
          <span className="hero-live-roll">
            {leaving === null ? null : (
              <AskText
                key={`out-${leaving}`}
                index={leaving}
                roll="out"
                onAnimationEnd={() =>
                  setRoll((current) =>
                    current.leaving === leaving ? { ...current, leaving: null } : current,
                  )
                }
              />
            )}
            <AskText key={demo} index={demo} roll={leaving === null ? undefined : "in"} />
          </span>
          <span id={countId} hidden>
            Reads {frame.count} of {NOTE_COUNT} notes.
          </span>
        </button>
      ) : (
        // What the copilot is doing is announced by the panel's status line.
        <p className="hero-live-line" aria-hidden="true">
          {mark}
          <span className="hero-live-text">
            {panelOpen ? "Shown in the copilot panel." : captionFor(view, busy, true)}
            {/* Only once the core has drawn: without it there is nothing lit. */}
            {!panelOpen && hasThread && !busy && coreOn ? (
              <span className="hero-live-count"> Lit in the core.</span>
            ) : null}
          </span>
        </p>
      )}
      {reduced ? null : (
        <button
          type="button"
          onClick={togglePause}
          aria-pressed={paused}
          className="hero-live-pause tap-square inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-[14px] text-muted hover:text-ink"
        >
          {paused ? (
            <Play size={15} aria-hidden="true" />
          ) : (
            <Pause size={15} aria-hidden="true" />
          )}
          {/* Never icon-only (WCAG 2.2.2 for people who do not know the
              icon): "Pause" is always shown, "motion" only where it fits.
              The name stays "Pause motion", which starts with what is seen. */}
          <span>Pause</span>{" "}
          <span className="hero-live-pause-more max-sm:sr-only">motion</span>
        </button>
      )}
    </div>
  );
}

/**
 * One demo question as the starter shows it. The question is clamped
 * (ellipsis); the count is outside the clamp so it is always shown whole.
 */
function AskText({
  index,
  roll,
  onAnimationEnd,
}: Readonly<{
  index: number;
  /** Rolling in or out of the starter; undefined when it simply stands. */
  roll?: "in" | "out";
  onAnimationEnd?: () => void;
}>) {
  const frame = DEMO[index % DEMO.length];
  const starter = starterQuestions[index % starterQuestions.length];
  return (
    <span
      className="hero-live-text"
      data-roll={roll}
      aria-hidden={roll === "out" ? true : undefined}
      onAnimationEnd={
        onAnimationEnd
          ? (event) => {
              if (event.target === event.currentTarget) onAnimationEnd();
            }
          : undefined
      }
    >
      <span className="hero-live-ask-q">
        <span className="hero-live-label">Ask:</span>{" "}
        <span className="hero-live-q" lang={starter.lang}>
          <span aria-hidden="true">“</span>
          {frame.question}
          <span aria-hidden="true">”</span>
        </span>
      </span>{" "}
      <span className="hero-live-count" aria-hidden="true">
        reads {frame.count} of {NOTE_COUNT} notes
      </span>
    </span>
  );
}
