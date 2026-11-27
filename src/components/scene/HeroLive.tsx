"use client";

import { Pause, Play } from "lucide-react";
import { useEffect } from "react";
import { useChat } from "@/components/chat/ChatProvider";
import { useIndexView } from "@/components/chat/IndexLattice";
import { captionFor } from "@/lib/index-caption";
import { DEMO } from "@/components/scene/MemoryCore";
import { PAUSE_KEY, sceneBus, useSceneBus } from "@/components/scene/scene-bus";
import { NOTE_COUNT } from "@/lib/chat-store";
import { starterQuestions } from "@/lib/knowledge";

const STEP_MS = 4200;

/**
 * The line under the hero statement that says what the core is showing.
 * Before anything is asked it plays the starter questions through the real
 * retriever; once the visitor types or asks, it follows them instead.
 */
export function HeroLive() {
  const { view, busy } = useIndexView();
  const demo = useSceneBus((s) => s.demo);
  const paused = useSceneBus((s) => s.paused);
  const reduced = useSceneBus((s) => s.reduced);
  const coreOn = useSceneBus((s) => s.core === "on");
  const heroInView = useSceneBus((s) => s.heroInView);
  const hasThread = useChat((state) => state.messages.length > 0);
  const resting = view.phase === "rest";

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
    if (!resting || paused || reduced || !heroInView) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      sceneBus.set({ demo: (sceneBus.get().demo + 1) % DEMO.length });
    }, STEP_MS);
    return () => window.clearInterval(timer);
  }, [resting, paused, reduced, heroInView]);

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
  const starter = starterQuestions[demo % starterQuestions.length];

  return (
    <div className="hero-live">
      {/* The demo repeats the starter questions, which are buttons elsewhere,
          so this changing line is not announced. */}
      <p className="hero-live-line" aria-hidden="true">
        <span
          className="hero-live-mark"
          data-lit={!resting || frame.count > 0}
          data-still={paused || reduced ? "true" : undefined}
        />
        {resting ? (
          <span key={demo} className="hero-live-text">
            <span lang={starter.lang}>“{frame.question}”</span>{" "}
            <span className="text-muted">
              The copilot would read {frame.count} of its {NOTE_COUNT} notes.
            </span>
          </span>
        ) : (
          <span className="hero-live-text">
            {captionFor(view, busy, true)}
            {/* Only once the core has drawn: without it there is nothing lit. */}
            {hasThread && !busy && coreOn ? (
              <span className="text-muted"> Lit in the core.</span>
            ) : null}
          </span>
        )}
      </p>
      {reduced ? null : (
        <button
          type="button"
          onClick={togglePause}
          aria-pressed={paused}
          className="tap-square inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-2 text-[14px] text-muted hover:text-ink"
        >
          {paused ? (
            <Play size={15} aria-hidden="true" />
          ) : (
            <Pause size={15} aria-hidden="true" />
          )}
          <span className="max-sm:sr-only">Pause motion</span>
        </button>
      )}
    </div>
  );
}
