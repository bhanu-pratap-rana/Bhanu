"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Ref,
} from "react";
import { useChat } from "@/components/chat/ChatProvider";
import { HexGlyph } from "@/components/chat/HexGlyph";
import { useIndexView } from "@/components/chat/IndexLattice";
import { DEMO, preloadCore } from "@/components/scene/MemoryCore";
import { sceneBus, useSceneBus } from "@/components/scene/scene-bus";
import { glyphFromGlow, hexPoints } from "@/lib/hex-glyph";
import { knowledgeBase } from "@/lib/knowledge";
import {
  CHIP_REST_MS,
  chipFromScroll,
  chipShown,
  flipFrom,
  glyphLevels,
  introActive,
  LAUNCHER_INTRO_MS,
  launcherView,
  launcherVisible,
  nextUnseen,
} from "@/lib/launcher-state";
import { coreGlow } from "@/lib/scene-state";

const IDS = knowledgeBase.map((item) => item.id);
const SENTINEL = "[data-launcher-sentinel]";

// The hex frame, drawn in SVG (never clip-path on the button: that would
// clip the focus halo and the rim, and kill the corners for the pointer).
// Its radius is 0.48 of the box; copilot-window.css derives the capsule's
// height (--launcher-rim-h) from the same number. The focus halo strokes
// this same polygon, so it stays concentric with the rim.
const RIM_R = 48;
const RIM = hexPoints(50, 50, RIM_R);

const FLIP_MS = 420;
const FLIP_EASE = "cubic-bezier(.3,1.25,.5,1)";
const GROW_MS = 220;
const GROW_EASE = "cubic-bezier(.2,.7,.2,1)";
const FADE_MS = 150;

// First use of the launcher this visit: until then its label always shows.
const USED_KEY = "copilot-launcher-used";
let usedCache: boolean | null = null;
const usedListeners = new Set<() => void>();

function readUsed(): boolean {
  if (usedCache === null) {
    try {
      usedCache = sessionStorage.getItem(USED_KEY) === "1";
    } catch {
      usedCache = false;
    }
  }
  return usedCache;
}

function markUsed() {
  if (readUsed()) return;
  usedCache = true;
  try {
    sessionStorage.setItem(USED_KEY, "1");
  } catch {
    /* remembered for this page view only */
  }
  usedListeners.forEach((listener) => listener());
}

function subscribeUsed(listener: () => void) {
  usedListeners.add(listener);
  return () => {
    usedListeners.delete(listener);
  };
}

// Phones and small tablets (under 64rem): the label would cover headings as
// the page scrolls under it, so the launcher is the hex alone there.
const WIDE_QUERY = "(min-width: 64rem)";

function subscribeWide(listener: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function readCompact(): boolean {
  return !window.matchMedia(WIDE_QUERY).matches;
}

// When the launcher first appeared in this page load (the label's intro on
// phones runs once, not again on every return from the hero).
let firstShownAt: number | null = null;

function boxOf(element: Element) {
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
}

function motionStill(): boolean {
  const { paused, reduced } = sceneBus.get();
  return (
    paused ||
    reduced ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The copilot's door: one object in the corner, a capsule labelled "Ask my
 * copilot" growing out of a hexagon that carries the same 7-cell mark as the
 * hero's button. The whole silhouette is one button. It is born from the
 * hero's button: hidden while that is in view, and once it scrolls away the
 * mark flies from it to the corner and the hexagon and capsule grow around
 * it. Its cells show
 * what the core is lighting; while an answer streams they light in turn,
 * and an answer that arrives while the copilot is closed leaves a dot.
 */
export function CopilotLauncher({
  buttonRef,
  controlsId,
  expanded,
  onPress,
}: Readonly<{
  buttonRef: Ref<HTMLButtonElement>;
  /** The id of the element the launcher opens (window or dialog). */
  controlsId: string;
  expanded: boolean;
  onPress: () => void;
}>) {
  const pathname = usePathname();
  const busy = useChat((state) => state.status !== "idle");
  const open = useChat((state) => state.open);
  const { view } = useIndexView();
  const demo = useSceneBus((s) => s.demo);
  // Quantised: the staging writes this on every scrolled frame.
  const heroExit = useSceneBus((s) => Math.round(s.heroExit * 20) / 20);
  const still = useSceneBus((s) => s.paused || s.reduced);
  const used = useSyncExternalStore(subscribeUsed, readUsed, () => false);
  const compact = useSyncExternalStore(subscribeWide, readCompact, () => false);

  const [sentinelInView, setSentinelInView] = useState(true);
  const [focused, setFocused] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [scrollShown, setScrollShown] = useState(true);
  const [intro, setIntro] = useState(false);

  // An answer that finished while the copilot was closed waits, unseen.
  const [seen, setSeen] = useState({ busy, open, unseen: false });
  if (seen.busy !== busy || seen.open !== open) {
    setSeen({
      busy,
      open,
      unseen: nextUnseen(seen.unseen, { wasBusy: seen.busy, busy, open }),
    });
  }

  const state = launcherView({ open, busy, unseenAnswer: seen.unseen });
  const visible = launcherVisible({ sentinelInView, open, busy, focused });
  const chip = chipShown({
    used,
    mode: state.mode,
    hovered,
    focused,
    scrollShown,
    compact,
    intro,
    focusVisible,
  });

  // The label's first appearance on a phone: up for LAUNCHER_INTRO_MS from
  // the moment the launcher is first shown, then the hex alone.
  useEffect(() => {
    if (!visible) return;
    const now = performance.now();
    firstShownAt ??= now;
    const left = LAUNCHER_INTRO_MS - (now - firstShownAt);
    const active = introActive(firstShownAt, now);
    const frame = requestAnimationFrame(() => setIntro(active));
    const timer = active ? window.setTimeout(() => setIntro(false), left) : 0;
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [visible]);

  const lit = useMemo(
    () =>
      glyphLevels(
        glyphFromGlow(
          coreGlow(view, IDS, DEMO[demo % DEMO.length].glow, true),
        ),
        heroExit,
      ),
    [view, demo, heroExit],
  );

  const rootRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<HTMLSpanElement>(null);
  const growRefs = useRef<HTMLSpanElement[]>([]);
  // Whether the first visibility has been applied: the one at mount never
  // animates. Later changes do: a route without a CTA crossfades it in, and
  // the hero's CTA flies it out and back.
  const settled = useRef(false);
  const shownRef = useRef(false);
  const running = useRef<Animation[]>([]);

  // The hero's CTA wrapper marks itself with `data-launcher-sentinel`.
  // Re-attached on every navigation: each page brings its own hero, or none.
  useEffect(() => {
    const sentinel = document.querySelector(SENTINEL);
    if (!sentinel) {
      const frame = requestAnimationFrame(() => setSentinelInView(false));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) =>
      setSentinelInView(entry.isIntersecting),
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pathname]);

  // Extended-FAB label: it tucks away while the page scrolls down fast and
  // comes back when scrolling up or once the page rests.
  useEffect(() => {
    let lastY = window.scrollY;
    let lastT = performance.now();
    let shown = true;
    let timer = 0;
    const apply = (next: boolean) => {
      if (next === shown) return;
      shown = next;
      setScrollShown(next);
    };
    const onScroll = () => {
      const t = performance.now();
      const y = window.scrollY;
      const dt = t - lastT;
      const velocity = dt > 0 ? ((y - lastY) / dt) * 1000 : 0;
      lastY = y;
      lastT = t;
      apply(chipFromScroll(shown, { velocity, idleMs: 0 }));
      window.clearTimeout(timer);
      timer = window.setTimeout(
        () => apply(chipFromScroll(shown, { velocity: 0, idleMs: CHIP_REST_MS })),
        CHIP_REST_MS,
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, []);

  // Enter and leave. Transform and opacity only, through the Web Animations
  // API, so nothing reflows. The glyph flies from (or back to) the hero
  // CTA's glyph; the frame and label grow around it.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const glyph = glyphRef.current;
    if (!root || !glyph) return;
    if (!settled.current) {
      settled.current = true;
      shownRef.current = visible;
      root.dataset.shown = String(visible);
      return;
    }
    if (shownRef.current === visible) return;
    shownRef.current = visible;
    running.current.forEach((animation) => animation.cancel());
    running.current = [];
    if (typeof root.animate !== "function") {
      root.dataset.shown = String(visible);
      return;
    }

    const grow = growRefs.current.filter(Boolean);
    const cta = document.querySelector(`${SENTINEL} [data-hex-glyph]`);
    root.dataset.shown = "true";
    const flip =
      cta && !motionStill()
        ? flipFrom(boxOf(cta), boxOf(glyph), window.innerHeight)
        : null;
    const hideWhenDone = (animation: Animation) => {
      animation.onfinish = () => {
        if (!shownRef.current) root.dataset.shown = "false";
      };
    };

    if (!flip) {
      const fade = root.animate(
        visible ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }],
        { duration: FADE_MS, easing: "ease-out", fill: "both" },
      );
      if (!visible) hideWhenDone(fade);
      fade.addEventListener("finish", () => fade.cancel());
      running.current = [fade];
      return;
    }

    const away = `translate(${flip.dx}px, ${flip.dy}px) scale(${flip.scale})`;
    const fly = glyph.animate(
      visible
        ? [{ transform: away }, { transform: "none" }]
        : [{ transform: "none" }, { transform: away, opacity: 0 }],
      { duration: FLIP_MS, easing: FLIP_EASE, fill: "both" },
    );
    const grows = grow.map((element) =>
      element.animate(
        visible
          ? [
              { opacity: 0, transform: "scale(0.6)" },
              { opacity: 1, transform: "none" },
            ]
          : [
              { opacity: 1, transform: "none" },
              { opacity: 0, transform: "scale(0.6)" },
            ],
        {
          duration: GROW_MS,
          easing: GROW_EASE,
          // Entering, the frame grows once the mark is under way.
          delay: visible ? FLIP_MS - GROW_MS : 0,
          fill: "both",
        },
      ),
    );
    if (!visible) hideWhenDone(fly);
    running.current = [fly, ...grows];
    // Drop the fills once done, so CSS owns the resting state again.
    fly.addEventListener("finish", () => {
      running.current.forEach((animation) => animation.cancel());
      running.current = [];
    });
  }, [visible]);

  return (
    <div
      ref={rootRef}
      className="copilot-launcher"
      data-copilot-launcher=""
      data-mode={state.mode}
      data-chip={chip ? "true" : "false"}
      data-still={still ? "true" : undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        className="launcher-button"
        aria-label={state.name}
        aria-expanded={expanded}
        aria-controls={controlsId}
        aria-describedby={state.description ? "copilot-launcher-state" : undefined}
        onClick={() => {
          markUsed();
          onPress();
        }}
        // Reaching for the door fetches the 3D core, so on a page that has
        // not booted it the window opens with the core flying in rather
        // than swapping in mid-animation.
        onFocus={(event) => {
          setFocused(true);
          // A tap, or a closing dialog returning focus, is not :focus-visible.
          setFocusVisible(event.currentTarget.matches(":focus-visible"));
          preloadCore();
        }}
        onBlur={() => {
          setFocused(false);
          setFocusVisible(false);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType !== "mouse") return;
          setHovered(true);
          preloadCore();
        }}
        onPointerLeave={() => setHovered(false)}
      >
        {/* One object: a capsule growing out of the hex, the hex sitting on
            its right end. Paint order matters (see copilot-window.css): the
            hex's focus halo, then the capsule, then the hex. */}
        <span className="launcher-body">
          <span
            className="launcher-halo-slot"
            ref={(element) => {
              if (element) growRefs.current[2] = element;
            }}
          >
            <svg
              className="launcher-halo"
              viewBox="0 0 100 100"
              aria-hidden="true"
              focusable="false"
            >
              <polygon className="launcher-halo-ink" points={RIM} />
              <polygon className="launcher-halo-gap" points={RIM} />
            </svg>
          </span>
          <span
            className="launcher-chip-slot"
            ref={(element) => {
              if (element) growRefs.current[0] = element;
            }}
          >
            <span className="launcher-chip" aria-hidden="true">
              <span className="launcher-chip-ink" />
              <span className="launcher-chip-gap" />
              <span className="launcher-chip-body" />
              <span className="launcher-chip-text">{state.label}</span>
            </span>
          </span>
          <span className="launcher-hex">
            <span
              className="launcher-frame-slot"
              ref={(element) => {
                if (element) growRefs.current[1] = element;
              }}
            >
              <svg
                className="launcher-frame"
                viewBox="0 0 100 100"
                aria-hidden="true"
                focusable="false"
              >
                <polygon className="launcher-pulse" points={RIM} />
                <polygon className="launcher-rim" points={RIM} />
              </svg>
              <span className="launcher-dot" aria-hidden="true" />
            </span>
            <span ref={glyphRef} className="launcher-glyph">
              <HexGlyph lit={lit} size={36} />
            </span>
            <X className="launcher-x" size={26} aria-hidden="true" />
          </span>
        </span>
      </button>
      <span id="copilot-launcher-state" className="sr-only">
        {state.description}
      </span>
    </div>
  );
}
