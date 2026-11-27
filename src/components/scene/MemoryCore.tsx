"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/components/chat/ChatProvider";
import { useIndexView } from "@/components/chat/IndexLattice";
import type { Core, CoreColors } from "@/components/scene/core-renderer";
import {
  type CoreStatus,
  PAUSE_KEY,
  sceneBus,
  useSceneBus,
} from "@/components/scene/scene-bus";
import { NOTE_COUNT } from "@/lib/chat-store";
import { axialToWorld, hexSpiral, ringOf } from "@/lib/honeycomb";
import {
  getProjectBySlug,
  knowledgeBase,
  shortTitle,
  starterQuestions,
} from "@/lib/knowledge";
import { coreGlow, demoFrames, sectionTargets } from "@/lib/scene-state";

const IDS = knowledgeBase.map((item) => item.id);
const ANCHORS = knowledgeBase.map((item) => item.anchor);
const LAYOUT = hexSpiral(NOTE_COUNT).map((cell) => ({
  ...axialToWorld(cell, 1),
  ring: ringOf(cell),
}));

/** The idle demo: each starter question, lit as the retriever would light it. */
export const DEMO = demoFrames(
  starterQuestions.map((starter) => starter.question),
  IDS,
);

/** How much the core fades once the hero has scrolled away. */
const FADE_BEHIND_TEXT = 0.8;
/** Clicks that travel further than this are drags or selections, not taps. */
const CLICK_SLOP_PX = 5;
const DOUBLE_CLICK_MS = 260;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** three.js 0.187 needs WebGL 2; the probe context is released straight away. */
function supportsWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return gl !== null;
  } catch {
    return false;
  }
}

function readColors(): CoreColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    body: v("--scene-body") || "#0f1838",
    edge: v("--scene-edge") || "#4d5f98",
    mist: v("--scene-mist") || "#bcd2ff",
    accent: v("--scene-accent") || v("--accent") || "#f5a524",
    additive: Number(v("--scene-add") || "1"),
  };
}

/** One lit note for a project page: the note the page is about. */
function projectTargets(slug: string): Float32Array {
  const targets = new Float32Array(NOTE_COUNT);
  const project = getProjectBySlug(slug);
  const index = project ? IDS.indexOf(project.kbId) : -1;
  if (index >= 0) targets[index] = 1;
  return targets;
}

/** The hero's open space: the section itself or the core's stage, never the copy. */
function inHeroSpace(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.id === "top" || target.closest("[data-core-stage]") !== null;
}

/**
 * Tell the hero whether the core is there. The attribute on <html> lets CSS
 * collapse the hero's empty stage when it will never draw.
 */
function markCore(status: CoreStatus) {
  sceneBus.set({ core: status });
  if (status === "pending") delete document.documentElement.dataset.core;
  else document.documentElement.dataset.core = status;
}

type Tip = { title: string; x: number; y: number };

/**
 * The copilot's memory, in 3D, behind the whole site: one prism per note.
 * Warm light marks what the copilot would pull, pulled or cited; a cool
 * edge marks the notes behind the section you are reading. It is a picture
 * of state the page also gives in words, so it is hidden from assistive tech.
 */
export function MemoryCore() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<Core | null>(null);
  const glowRef = useRef(new Float32Array(NOTE_COUNT));
  const sectionRef = useRef(new Float32Array(NOTE_COUNT));
  const stillRef = useRef(false);
  const store = useChatStore();
  const pathname = usePathname();
  const { view } = useIndexView();
  const demo = useSceneBus((s) => s.demo);
  const heroInView = useSceneBus((s) => s.heroInView);
  const motionOff = useSceneBus((s) => s.paused || s.reduced);
  // The pause control lives in the hero, so pages without one hold still.
  const still = motionOff || pathname !== "/";
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);

  // What the copilot touched. At rest the idle demo stands in for it, but
  // only beside the hero's readout: a project page, or the page below the
  // hero, would otherwise light warm notes that outshine its own.
  useEffect(() => {
    const demoShowing = pathname === "/" && heroInView;
    const glow = coreGlow(view, IDS, DEMO[demo % DEMO.length].glow, demoShowing);
    glowRef.current.set(glow);
    coreRef.current?.inputs.glow.set(glow);
  }, [view, demo, pathname, heroInView]);

  useEffect(() => {
    stillRef.current = still;
    if (coreRef.current) coreRef.current.inputs.still = still;
    // Re-measure: with motion off the hero steps rather than glides.
    window.dispatchEvent(new Event("scroll"));
  }, [still]);

  // The section being read lights its notes; a project page lights its own.
  useEffect(() => {
    const apply = (targets: ArrayLike<number>) => {
      sectionRef.current.set(targets);
      coreRef.current?.inputs.section.set(sectionRef.current);
    };
    const project = pathname.match(/^\/projects\/([^/]+)/);
    if (project) {
      apply(projectTargets(decodeURIComponent(project[1])));
      return;
    }
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("main section[id]"),
    );
    if (sections.length === 0) {
      apply(sectionTargets(null, ANCHORS));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) apply(sectionTargets(entry.target.id, ANCHORS));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  // Boot the renderer once the page is idle; the page never waits for it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let paused = false;
    try {
      paused = localStorage.getItem(PAUSE_KEY) === "1";
    } catch {
      /* no storage: motion stays on */
    }
    sceneBus.set({ reduced: reducedQuery.matches, paused });
    const onReduced = () => sceneBus.set({ reduced: reducedQuery.matches });
    reducedQuery.addEventListener("change", onReduced);

    // Forced colours strip the text shadows that keep type legible over the
    // core, and a coloured 3D scene has no place there anyway.
    const forced = window.matchMedia("(forced-colors: active)").matches;
    if (forced || !supportsWebGL2()) {
      markCore("off");
      return () => {
        reducedQuery.removeEventListener("change", onReduced);
        markCore("pending");
      };
    }

    let cancelled = false;
    let core: Core | null = null;
    const cleanups: (() => void)[] = [];
    const laptopQuery = window.matchMedia("(min-width: 64rem)");

    function measure() {
      if (!core || !canvas) return;
      const inputs = core.inputs;
      const vw = window.innerWidth;
      // The layer is 100lvh: its height does not change as phone toolbars
      // slide, so the back stage does not jump mid-scroll.
      const vh = canvas.clientHeight || window.innerHeight;
      const doc = document.documentElement;
      inputs.scroll = clamp01(window.scrollY / Math.max(1, doc.scrollHeight - window.innerHeight));

      const page = document.getElementById("page")?.getBoundingClientRect();
      const pageLeft = page?.left ?? 0;
      const pageW = page?.width ?? vw;
      inputs.backStage = {
        cx: pageLeft + pageW / 2,
        cy: vh * 0.55,
        r: Math.min(pageW, vh) * 0.42,
      };

      const stage = document.querySelector("[data-core-stage]")?.getBoundingClientRect();
      if (stage && stage.height > 0) {
        // Same breakpoint as the CSS that overlaps the stage with the copy.
        const laptop = laptopQuery.matches;
        let r = Math.min(stage.width, stage.height) * (laptop ? 0.48 : 0.56);
        let cy = stage.top + stage.height / 2;
        // Laptops: keep the drawn cluster (its bottom sits about 0.9 r below
        // centre) above the name. In a very short window there is no room,
        // so the centre stays inside the stage and the core meets the name.
        const lockupTop = laptop
          ? document.querySelector(".lockup")?.getBoundingClientRect().top
          : undefined;
        if (lockupTop !== undefined) {
          const room = lockupTop - 16 - stage.top;
          r = Math.max(110, Math.min(r, room / 1.9));
          cy = Math.max(stage.top + 0.5 * r, Math.min(cy, lockupTop - 16 - 0.9 * r));
        }
        inputs.heroStage = { cx: stage.left + stage.width / 2, cy, r };
        const progress = clamp01(window.scrollY / (vh * 0.85));
        // With motion off, the core steps between its two places.
        inputs.hero = stillRef.current ? (progress < 0.5 ? 0 : 1) : progress;
      } else {
        inputs.heroStage = inputs.backStage;
        inputs.hero = 1;
      }

      // Behind running text the core is only a texture: fade the whole layer
      // (a compositor-only change) so no prism ever competes with the words.
      if (layerRef.current) {
        layerRef.current.style.opacity = String(1 - FADE_BEHIND_TEXT * inputs.hero);
      }
    }

    function updateHidden() {
      if (!core) return;
      core.inputs.hidden =
        document.hidden ||
        document.querySelector("dialog.copilot-dialog[open]") !== null;
    }

    function listenForDpr() {
      // Zoom or a move to another display changes the pixel ratio.
      const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      const onChange = () => {
        core?.resize();
        measure();
        listenForDpr();
      };
      query.addEventListener("change", onChange, { once: true });
      cleanups.push(() => query.removeEventListener("change", onChange));
    }

    function start() {
      import("@/components/scene/core-renderer")
        .then(({ createCore }) => {
          if (cancelled || !canvas) return;
          core = createCore(canvas, LAYOUT, () => {
            setReady(true);
            markCore("on");
          });
          coreRef.current = core;
          core.setColors(readColors());
          core.inputs.glow.set(glowRef.current);
          core.inputs.section.set(sectionRef.current);
          core.inputs.still = stillRef.current;
          measure();
          updateHidden();

          window.addEventListener("resize", measure);
          window.addEventListener("scroll", measure, { passive: true });
          document.addEventListener("visibilitychange", updateHidden);
          cleanups.push(() => {
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure);
            document.removeEventListener("visibilitychange", updateHidden);
          });
          listenForDpr();

          // three keeps the scene and restores it after a context loss; this
          // only hides the canvas while the GPU is away.
          const onLost = () => setReady(false);
          const onRestored = () => {
            core?.resize();
            measure();
            setReady(true);
          };
          canvas.addEventListener("webglcontextlost", onLost);
          canvas.addEventListener("webglcontextrestored", onRestored);
          cleanups.push(() => {
            canvas.removeEventListener("webglcontextlost", onLost);
            canvas.removeEventListener("webglcontextrestored", onRestored);
          });

          // Theme switches and the phone dialog opening both show up as
          // attribute changes.
          const themeObserver = new MutationObserver(() => {
            core?.setColors(readColors());
          });
          themeObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-theme"],
          });
          const dialogObserver = new MutationObserver(updateHidden);
          dialogObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ["open"],
            subtree: true,
          });
          // The canvas box (scrollbar appearing, window resize) sizes the
          // drawing buffer; layout shifts in the page move the stage.
          const canvasObserver = new ResizeObserver(() => {
            core?.resize();
            measure();
          });
          canvasObserver.observe(canvas);
          const pageObserver = new ResizeObserver(measure);
          pageObserver.observe(document.body);
          cleanups.push(() => {
            themeObserver.disconnect();
            dialogObserver.disconnect();
            canvasObserver.disconnect();
            pageObserver.disconnect();
          });
        })
        .catch(() => {
          // The page is complete without the core; it just stops promising one.
          if (!cancelled) markCore("off");
        });
    }

    // Older Safari has no requestIdleCallback.
    const hasIdle = typeof (window as Partial<Window>).requestIdleCallback === "function";
    const idle = hasIdle ? window.requestIdleCallback(start, { timeout: 1200 }) : 0;
    const timeout = hasIdle ? 0 : window.setTimeout(start, 200);

    return () => {
      cancelled = true;
      if (hasIdle) window.cancelIdleCallback(idle);
      window.clearTimeout(timeout);
      reducedQuery.removeEventListener("change", onReduced);
      cleanups.forEach((cleanup) => cleanup());
      core?.dispose();
      coreRef.current = null;
      // A remount (Strict Mode, Fast Refresh) boots afresh and reports again.
      markCore("pending");
    };
  }, []);

  // After client navigation: re-measure (the hero may have come or gone) and
  // drop any hover left over from the page before.
  useEffect(() => {
    if (coreRef.current) coreRef.current.inputs.hover = -1;
    document.documentElement.classList.remove("core-hover");
    // Clear first, then re-measure: the re-measure may hover a prism afresh.
    const frame = requestAnimationFrame(() => {
      setTip(null);
      window.dispatchEvent(new Event("scroll"));
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  // Mouse only: lean the camera, and in the hero's open space, hover a
  // prism to name its note and click to ask about it.
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let last: { x: number; y: number } | null = null;
    let down: { x: number; y: number; inSpace: boolean } | null = null;
    // The ask waits out the double-click interval, so a double-click asks nothing.
    let pending = 0;
    // Escape hides the tooltip for this prism until the pointer moves to another.
    let dismissed = -1;

    function setHover(index: number, x = 0, y = 0) {
      const core = coreRef.current;
      if (core) core.inputs.hover = index;
      document.documentElement.classList.toggle("core-hover", index >= 0);
      setTip(
        index >= 0
          ? { title: shortTitle(knowledgeBase[index]), x, y }
          : null,
      );
    }

    function updateHover(x: number, y: number, target: EventTarget | null) {
      const core = coreRef.current;
      if (!core) {
        setHover(-1);
        return;
      }
      let index = inHeroSpace(target) ? core.pick(x, y) : -1;
      if (dismissed >= 0 && index !== dismissed) dismissed = -1;
      if (index === dismissed) index = -1;
      setHover(index, x, y);
    }

    function onMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      const core = coreRef.current;
      if (core) {
        core.inputs.pointer = {
          x: (event.clientX / window.innerWidth) * 2 - 1,
          y: (event.clientY / window.innerHeight) * 2 - 1,
        };
      }
      last = { x: event.clientX, y: event.clientY };
      updateHover(event.clientX, event.clientY, event.target);
    }

    // Wheel and keyboard scrolling move the page under a still pointer.
    function onScroll() {
      if (!last) return;
      updateHover(last.x, last.y, document.elementFromPoint(last.x, last.y));
    }

    function onDown(event: PointerEvent) {
      window.clearTimeout(pending);
      // Mouse only: on a touchscreen laptop a finger tap has no tooltip first.
      down =
        event.pointerType === "mouse"
          ? { x: event.clientX, y: event.clientY, inSpace: inHeroSpace(event.target) }
          : null;
    }

    function onClick(event: MouseEvent) {
      const core = coreRef.current;
      const start = down;
      down = null;
      // Only a plain single click that started and ended in open hero space.
      if (!core || !start?.inSpace || event.detail !== 1) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (!inHeroSpace(event.target)) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      const index = core.pick(event.clientX, event.clientY);
      if (index < 0) return;
      pending = window.setTimeout(() => {
        // Never overwrite what the visitor is writing: show it to them instead.
        if (store.getState().draft.trim()) {
          store.requestFocus();
          return;
        }
        store.open();
        void store.ask(knowledgeBase[index].prompt);
      }, DOUBLE_CLICK_MS);
    }

    function onKey(event: KeyboardEvent) {
      const core = coreRef.current;
      if (event.key !== "Escape" || !core || core.inputs.hover < 0) return;
      dismissed = core.inputs.hover;
      setHover(-1);
    }

    function onLeave() {
      last = null;
      setHover(-1);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.clearTimeout(pending);
    };
  }, [store]);

  return (
    <>
      <div ref={layerRef} className="core-layer" aria-hidden="true">
        <canvas
          ref={canvasRef}
          className="core-canvas"
          data-ready={ready ? "true" : undefined}
        />
      </div>
      {tip ? (
        <div
          className="core-tip"
          style={{ left: tip.x, top: tip.y }}
          aria-hidden="true"
        >
          <span className="font-semibold">{tip.title}</span>
          <span className="text-muted">Click to ask the copilot. Esc hides this.</span>
        </div>
      ) : null}
    </>
  );
}
