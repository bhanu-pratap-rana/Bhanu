"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { IndexLattice } from "@/components/chat/IndexLattice";
import { useSceneBus } from "@/components/scene/scene-bus";
import { type FallbackFit, heroFallbackFit, windowLayoutBox } from "@/lib/core-stage";
import { heroFallbackShown } from "@/lib/hero-fallback";

/** The laptop copilot window (CopilotHost); always in the DOM, hidden when closed. */
const WINDOW_ID = "copilot";

const CLEAR: FallbackFit = { show: true, cut: 0 };

/**
 * The window's laid-out left edge while it is open over the page, else null:
 * closed, closing, or tucked down to its title strip (which sits below the
 * stage). Its open animation scales it about its bottom-right corner, so the
 * laid-out box is used, not the drawn one.
 */
function windowLeftOverStage(win: HTMLElement | null): number | null {
  if (!win || win.hidden || win.dataset.state !== "open" || win.dataset.tucked === "true") return null;
  const { left, top, width, height } = win.getBoundingClientRect();
  if (!(width > 0)) return null;
  return windowLayoutBox({ left, top, width, height }, win.offsetWidth, win.offsetHeight).left;
}

/**
 * What fills the hero's stage whenever the 3D core is not drawn there: while
 * it is still loading (also the server render, so the first paint is never
 * half empty), when it cannot draw (no WebGL 2, the renderer failed to load:
 * "off") or its GPU context is gone ("lost"), and while it is away in the
 * laptop copilot window's dock. The same 2D note lattice the dock falls back
 * to, lit by the same state. It stays mounted and cross-fades (hero.css), so
 * the stage keeps its size and the core's own fade-in meets it. Decorative:
 * the stage is aria-hidden and the readout below says the same in words.
 * Forced colours and no-JS collapse the stage in CSS instead (hero.css,
 * layout.tsx).
 *
 * While the laptop window is open over the stage, the lattice keeps to the
 * part of the stage left of the window, and fades out when that part is too
 * narrow to hold it (core-stage heroFallbackFit): never a sliver half behind
 * the window.
 */
export function HeroStageFallback() {
  const core = useSceneBus((s) => s.core);
  // Written by MemoryCore's staging, the one place that decides the dock.
  const docked = useSceneBus((s) => s.coreDocked);
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<FallbackFit>(CLEAR);
  // The cut last drawn with: kept while the lattice fades out, so it never
  // jumps in size on its way out (the window closing clears the fit first).
  const [cut, setCut] = useState(0);
  const shown = heroFallbackShown({ core, docked }) && fit.show;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      // The box as laid out: the cut is padding inside it, so it stays put.
      const box = el.getBoundingClientRect();
      const next = heroFallbackFit(box, windowLeftOverStage(document.getElementById(WINDOW_ID)));
      setFit((prev) => (prev.show === next.show && prev.cut === next.cut ? prev : next));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("resize", schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(el);
    // Opening, closing and tucking the window are attribute changes on it.
    // Measured and rendered at once: the observer runs as a microtask, and
    // flushSync commits the fit there instead of in a later Scheduler task,
    // so it is in place before the next paint and the lattice never shows
    // docked with the stale fit (a sliver fading in behind the window).
    const win = document.getElementById(WINDOW_ID);
    const attrs = new MutationObserver(() => {
      if (raf) cancelAnimationFrame(raf);
      flushSync(measure);
    });
    if (win) {
      attrs.observe(win, { attributes: true, attributeFilter: ["hidden", "data-state", "data-tucked"] });
      resize.observe(win);
    }
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      resize.disconnect();
      attrs.disconnect();
    };
  }, []);

  // Follow the fit only while drawn; hidden, it keeps the cut it faded with.
  if (shown && cut !== fit.cut) setCut(fit.cut);

  const style = cut > 0 ? ({ "--window-cut": `${cut}px` } as CSSProperties) : undefined;

  return (
    <div ref={ref} className="hero-fallback" data-shown={shown ? "true" : "false"} style={style}>
      <IndexLattice size="full" />
    </div>
  );
}
