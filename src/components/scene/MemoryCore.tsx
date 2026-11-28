"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useChat, useChatStore, useIsDesktop } from "@/components/chat/ChatProvider";
import { useIndexView } from "@/components/chat/IndexLattice";
import { countCitations } from "@/components/markdown";
import type { Core, CoreColors } from "@/components/scene/core-renderer";
import {
  type CoreStatus,
  PAUSE_KEY,
  coreCanDock,
  sceneBus,
  useSceneBus,
} from "@/components/scene/scene-bus";
import { NOTE_COUNT } from "@/lib/chat-store";
import { DESKTOP_QUERY } from "@/lib/copilot-host";
import {
  type CoreKind,
  type CorePlacement,
  type CorePresence,
  type Rect,
  answerRipples,
  createFlight,
  dockClip,
  intersectRect,
  flightFrom,
  heroCorePlacement,
  heroExitProgress,
  heroTravel,
  isDocked,
  keepOutAround,
  launcherFootprint,
  launcherRestBox,
  mapRect,
  resolveCoreStage,
  startFlight,
  stepFlight,
  windowLayoutBox,
  windowVisibleRect,
} from "@/lib/core-stage";
import { neuralFromSearch } from "@/lib/core-neural";
import { axialToWorld, hexSpiral, ringOf } from "@/lib/honeycomb";
import {
  getProjectBySlug,
  knowledgeBase,
  shortTitle,
  starterQuestions,
} from "@/lib/knowledge";
import { coreGlow, demoFrames, glowTargets, sectionTargets } from "@/lib/scene-state";

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

/** The box in the hero that the core sits in (hero.css sizes it). */
const STAGE = "[data-core-stage]";
/** The hero's copy column; the core keeps clear of it on laptops. */
const COPY = "[data-hero-copy]";
/** The laptop copilot window (CopilotHost) and the box in it the core docks in (CopilotPanel). */
const WINDOW = "#copilot";
const DOCK = "[data-core-dock]";
const PANEL_HEAD = ".copilot-panel-head";
/** The launcher's label capsule (CopilotLauncher): part of the hero's keep-out. */
const LAUNCHER_CHIP = ".launcher-chip";
/** Clicks that travel further than this are drags or selections, not taps. */
const CLICK_SLOP_PX = 5;
const DOUBLE_CLICK_MS = 260;
/** The tooltip flips to the pointer's left this close to the right edge. */
const TIP_FLIP_PX = 320;
/** A renderer download that failed is tried again this many times (window open, back online). */
const MAX_IMPORT_RETRIES = 2;

// The renderer's module, fetched once: by the boot, or ahead of it when the
// visitor reaches for the launcher on a page whose core has not booted.
type RendererModule = typeof import("@/components/scene/core-renderer");
let rendererLoad: Promise<RendererModule> | null = null;

function loadRenderer(): Promise<RendererModule> {
  rendererLoad ??= import("@/components/scene/core-renderer").catch((error: unknown) => {
    // Let a later attempt try again.
    rendererLoad = null;
    throw error;
  });
  return rendererLoad;
}

/**
 * Fetch the renderer before the copilot window opens (launcher hover or
 * focus), so on a page without a hero the core can take the dock as the
 * window opens instead of swapping in mid-animation. Laptop window only:
 * the phone dialog keeps the 2D lattice. MemoryCore boots it on open.
 */
export function preloadCore(): void {
  if (typeof window === "undefined") return;
  if (!window.matchMedia(DESKTOP_QUERY).matches) return;
  if (window.matchMedia("(forced-colors: active)").matches) return;
  void loadRenderer().catch(() => undefined);
}

// The probe's answer, once per visit: client navigations never probe again.
let webgl2: boolean | null = null;

// The neural layer is the core's look everywhere; `?core=classic` (read once
// per visit on the client, the first time the renderer is made) brings back
// the direct threads for comparison only.
let neuralMode: boolean | null = null;

function readNeuralMode(): boolean {
  neuralMode ??= neuralFromSearch(window.location.search);
  return neuralMode;
}

/**
 * three.js 0.187 needs WebGL 2; the probe context is released straight away.
 * Only called right before the renderer would load (at idle on a page with
 * a hero stage, or as the window opens), never during hydration.
 */
function supportsWebGL2(): boolean {
  if (webgl2 !== null) return webgl2;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    webgl2 = gl !== null;
  } catch {
    webgl2 = false;
  }
  return webgl2;
}

function readColors(): CoreColors {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string) => css.getPropertyValue(name).trim();
  const accent = v("--scene-accent") || v("--accent") || "#ffa51f";
  return {
    body: v("--scene-body") || "#111a4a",
    edge: v("--scene-edge") || "#5b6cff",
    mist: v("--scene-mist") || "#7fe6ff",
    accent,
    // Without the gradient stops the top falls back to one flat accent.
    hot: v("--scene-hot") || accent,
    rim: v("--scene-rim") || accent,
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

/**
 * Where the core can be pointed at: the hero's open space (the section or
 * the core's stage, never the copy) and the copilot window's dock.
 */
function inCoreSpace(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.id === "top" || target.closest(`${STAGE}, ${DOCK}`) !== null;
}

/**
 * Tell the page whether the core is there. The attribute on <html> lets CSS
 * collapse the hero's empty stage when it will never draw; the bus tells
 * the copilot window whether the dock gets the 3D core or the 2D lattice.
 */
function markCore(status: CoreStatus) {
  sceneBus.set({ core: status });
  if (status === "pending") delete document.documentElement.dataset.core;
  else document.documentElement.dataset.core = status;
}

/** How far the hero has left, on the bus for the launcher's hand-off. */
function publishExit(k: number) {
  const value = Math.round(k * 100) / 100;
  if (sceneBus.get().heroExit !== value) sceneBus.set({ heroExit: value });
}

const rectOf = ({ left, top, width, height }: DOMRect): Rect => ({ left, top, width, height });

/**
 * The copilot window's dock, read off the page (the window floats and
 * animates, so this runs every frame while it is open): where the core goes
 * (the dock as laid out, so a flight that starts while the window is still
 * scaling up lands where it ends up) and what it may draw (the part of the
 * dock on screen: none of it while the window is tucked).
 */
function readDock(): { place: Rect; clip: Rect } | null {
  const win = document.querySelector<HTMLElement>(WINDOW);
  const dock = win?.querySelector<HTMLElement>(DOCK);
  if (!win || !dock) return null;
  const drawn = rectOf(dock.getBoundingClientRect());
  if (!(drawn.width > 0) || !(drawn.height > 0)) return null;
  const winDrawn = rectOf(win.getBoundingClientRect());
  const winLaid = windowLayoutBox(winDrawn, win.offsetWidth, win.offsetHeight);
  let visible = windowVisibleRect(winDrawn, win.dataset.tucked === "true");
  // The header scrolls and shrinks on short screens; the DOM dock is clipped
  // to its scrollport, so the core is too, never drawn over the thread below.
  const head = dock.closest<HTMLElement>(PANEL_HEAD);
  if (head) visible = intersectRect(visible, rectOf(head.getBoundingClientRect()));
  return {
    place: mapRect(drawn, winDrawn, winLaid),
    clip: dockClip(drawn, visible),
  };
}

/** Docked or flying, the core is drawn above the window (hero.css: window 40, core 41, launcher 42). */
function overWindow(kind: CoreKind): boolean {
  return kind === "dock" || kind === "flight";
}

type Staging = {
  /** The core's hero placement with the page at the top (viewport px), or null. */
  rest: CorePlacement | null;
  /** Scroll over which the hero leaves; null when this page has none. */
  travel: number | null;
  /** Where the launcher rests: the core shrinks into it and grows out of it. */
  launcher: Rect;
};

function launcherBox(viewW: number): Rect {
  const root = getComputedStyle(document.documentElement);
  return launcherRestBox(
    viewW,
    window.innerHeight,
    parseFloat(root.getPropertyValue("--launcher-size")),
    parseFloat(root.getPropertyValue("--launcher-gap")),
  );
}

/**
 * Where the hero puts the core. This reads layout, so it runs on resize and
 * layout changes only; scrolling just offsets the result (the hero is in
 * the page's flow, the canvas is fixed).
 */
function measureStaging(canvas: HTMLCanvasElement | null): Staging {
  // The canvas box: the core may bleed past the page gutter to its edge.
  const viewW = canvas?.clientWidth || document.documentElement.clientWidth;
  // Where the launcher rests, from the sizes copilot-window.css gives it.
  const launcher = launcherBox(viewW);
  const none: Staging = { rest: null, travel: null, launcher };
  const hero = document.getElementById("top");
  if (!hero) return none;
  const scrollY = window.scrollY;
  const stage = document.querySelector<HTMLElement>(STAGE);
  const box = stage?.getBoundingClientRect();
  if (!stage || !box || box.width === 0 || box.height === 0) {
    // No stage (the core is off here): the hero itself sets the pace.
    return { ...none, travel: hero.getBoundingClientRect().bottom + scrollY };
  }
  // In the split layout the stage covers the hero, beside the copy column.
  const split = getComputedStyle(stage).position === "absolute";
  const copy = split ? document.querySelector(COPY)?.getBoundingClientRect() : undefined;
  const rest = heroCorePlacement({
    stage: { left: box.left, top: box.top + scrollY, width: box.width, height: box.height },
    copyRight: copy ? copy.right : null,
    viewRight: viewW,
    // A keep-out always (not only while the launcher shows), so the core
    // never changes size mid-scroll as the launcher arrives.
    // The hex and its label capsule (offsetWidth: its laid-out width, not
    // the collapsed transform), plus the margin.
    keepOut: keepOutAround(
      launcherFootprint(
        launcher,
        document.querySelector<HTMLElement>(LAUNCHER_CHIP)?.offsetWidth ?? Number.NaN,
      ),
    ),
  });
  if (rest.r <= 0) return { ...none, travel: box.bottom + scrollY };
  return { rest, travel: heroTravel(rest), launcher };
}

/** What the tooltip says and how it sits; its position is written straight to the element. */
type Tip = { index: number; title: string; over: boolean; flip: boolean };

const NO_STAGING: Staging = {
  rest: null,
  travel: null,
  launcher: { left: 0, top: 0, width: 0, height: 0 },
};

/**
 * The copilot's memory, in 3D: one prism per note. Warm light marks what the
 * copilot would pull, pulled or cited; a cool edge marks the notes behind
 * the section coming up. In the hero it follows the page as it scrolls,
 * settles and fades as the hero leaves. When the laptop copilot window
 * opens it flies into the window's dock (or grows out of the launcher, when
 * the hero is not in view) and lights what the copilot reads there; closing
 * flies it back, or shrinks it into the launcher. It is a picture of state
 * the page also gives in words, so it is hidden from assistive tech.
 */
export function MemoryCore() {
  const layerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coreRef = useRef<Core | null>(null);
  const glowRef = useRef(new Float32Array(NOTE_COUNT));
  const sectionRef = useRef(new Float32Array(NOTE_COUNT));
  const stillRef = useRef(false);
  const motionOffRef = useRef(false);
  // The laptop window is open: the core belongs in its dock.
  const windowOpenRef = useRef(false);
  const stagingRef = useRef<Staging>(NO_STAGING);
  // Set by the effects that own them, called by the others. `frame` restages
  // now (scroll, resize, state changes); `tick` runs at the start of each of
  // the renderer's frames.
  const stagingFns = useRef<{
    measure: () => void;
    frame: () => void;
    /** True while the renderer must run every frame (a flight, the dock). */
    tick: (dt: number, wallDt: number) => boolean;
  }>({ measure: () => {}, frame: () => {}, tick: () => false });
  const bootRef = useRef<((now?: boolean) => void) | null>(null);
  // The answer being written, so its citations ripple once it has arrived.
  const inFlightRef = useRef<string | null>(null);
  const store = useChatStore();
  const pathname = usePathname();
  const { view } = useIndexView();
  const streamingId = useChat((state) => state.streamingId);
  const open = useChat((state) => state.open);
  const isDesktop = useIsDesktop();
  const demo = useSceneBus((s) => s.demo);
  const heroInView = useSceneBus((s) => s.heroInView);
  const canDock = useSceneBus((s) => coreCanDock(s.core));
  const motionOff = useSceneBus((s) => s.paused || s.reduced);
  // The pause control lives in the hero, so pages without one hold still
  // (no drift; flights, being short and asked for, still fly unless motion is off).
  const still = motionOff || pathname !== "/";
  const windowOpen = isDesktop && open;
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<Tip | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // The pointer the tooltip follows, written to it without a re-render.
  const tipAt = useRef({ x: 0, y: 0 });

  // What the copilot touched. At rest the idle demo stands in for it, but
  // only beside the hero's readout: below the hero the demo would light
  // warm notes the visitor never asked about. In the window's dock the core
  // sits beside the caption that names what the first question would pull,
  // so it lights that.
  useEffect(() => {
    const demoShowing = pathname === "/" && heroInView;
    const glow =
      windowOpen && canDock && view.phase === "rest"
        ? glowTargets({ ...view, phase: "preview" }, IDS)
        : coreGlow(view, IDS, DEMO[demo % DEMO.length].glow, demoShowing);
    glowRef.current.set(glow);
    coreRef.current?.inputs.glow.set(glow);
    coreRef.current?.wake();
  }, [view, demo, pathname, heroInView, windowOpen, canDock]);

  useEffect(() => {
    stillRef.current = still;
    if (coreRef.current) coreRef.current.inputs.still = still;
    // Re-stage: with motion off the hero steps rather than glides.
    stagingFns.current.frame();
  }, [still]);

  useEffect(() => {
    motionOffRef.current = motionOff;
  }, [motionOff]);

  // An answer arriving ripples out from the notes it cites: once, when it
  // has finished (not for a stopped answer, nor for a thread restored on load).
  useEffect(() => {
    if (streamingId) {
      inFlightRef.current = streamingId;
      return;
    }
    const id = inFlightRef.current;
    inFlightRef.current = null;
    const core = coreRef.current;
    if (!id || !core) return;
    const answer = store.getState().messages.find((message) => message.id === id);
    if (!answer || answer.kind !== "answer" || answer.stopped || answer.totalMs === undefined) return;
    const sources = answer.sources ?? [];
    const cited = countCitations(answer.content, sources.length).cited.map((n) => sources[n - 1]);
    for (const { index, amp } of answerRipples(cited, IDS)) core.ripple(index, amp);
  }, [streamingId, store]);

  // The section being read lights its notes; a project page lights its own.
  useEffect(() => {
    const apply = (targets: ArrayLike<number>) => {
      sectionRef.current.set(targets);
      coreRef.current?.inputs.section.set(sectionRef.current);
      coreRef.current?.wake();
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

  // Staging, on every route and with or without WebGL: the launcher reads
  // the hero's exit from the bus either way. Layout is measured on resize and
  // layout changes; a scroll only offsets it, so the core follows exactly.
  // While the window is open (or a flight is under way) the renderer calls
  // `tick` at the start of each frame, so the core follows the dock frame by
  // frame and flies on the renderer's clock.
  useEffect(() => {
    const flight = createFlight();
    // The last target was the dock: a change either way is an open or a close.
    let docked = false;

    function target(): CorePresence {
      const { rest, travel, launcher } = stagingRef.current;
      const scrolled = Math.max(0, window.scrollY);
      const exit = heroExitProgress(scrolled, travel);
      publishExit(exit);
      const hero = rest ? { cx: rest.cx, cy: rest.cy - scrolled, r: rest.r } : null;
      const isOpen = windowOpenRef.current;
      const dock = isOpen ? readDock() : null;
      return resolveCoreStage({
        hero,
        exit,
        still: stillRef.current,
        open: isOpen,
        dock: dock?.place,
        clip: dock?.clip,
        launcher,
      });
    }

    function syncLayer(kind: CoreKind) {
      const layer = layerRef.current;
      if (!layer) return;
      const over = overWindow(kind);
      if ((layer.dataset.over === "true") === over) return;
      if (over) layer.dataset.over = "true";
      else delete layer.dataset.over;
    }

    function stage(dt: number, wallDt = dt) {
      const next = target();
      const core = coreRef.current;
      if (!core) return;
      const shown = core.inputs.presence;
      // Only opening and closing the window fly the core: into the dock from
      // where it is drawn (the hero, or the launcher's hex when nothing is),
      // and back to the hero or into the launcher. Everything else (scroll,
      // resize, font load, the window tucking) is followed exactly.
      if (isDocked(next) !== docked) {
        docked = isDocked(next);
        sceneBus.set({ coreDocked: docked });
        if (!motionOffRef.current) startFlight(flight, flightFrom(shown, stagingRef.current.launcher));
      }
      // Reduced motion or paused: no flight, it is simply there.
      if (motionOffRef.current) flight.active = false;
      stepFlight(flight, next, dt, shown, wallDt);
      syncLayer(shown.kind);
    }

    /** Restage now (scroll, resize, state changes), and wake the renderer to draw it. */
    function frame() {
      stage(0);
      coreRef.current?.wake();
    }
    function measure() {
      stagingRef.current = measureStaging(canvasRef.current);
      frame();
    }
    // In the renderer's frame: no wake here, the renderer decides from the result.
    function tick(dt: number, wallDt: number) {
      if (flight.active || docked || windowOpenRef.current) stage(dt, wallDt);
      return flight.active || docked || windowOpenRef.current;
    }
    stagingFns.current = { measure, frame, tick };

    window.addEventListener("scroll", frame, { passive: true });
    window.addEventListener("resize", measure);
    // Anything that grows or shrinks the page can move the hero in it.
    const pageObserver = new ResizeObserver(measure);
    pageObserver.observe(document.body);
    let live = true;
    // The name's web font changes the copy's height, and with it the hero's.
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    measure();
    return () => {
      live = false;
      window.removeEventListener("scroll", frame);
      window.removeEventListener("resize", measure);
      pageObserver.disconnect();
      stagingFns.current = { measure: () => {}, frame: () => {}, tick: () => false };
      if (sceneBus.get().coreDocked) sceneBus.set({ coreDocked: false });
    };
  }, []);

  // Boot the renderer once the page is idle, and only on a page with a
  // hero stage; the page never waits for it. Opening the laptop window boots
  // it at once on any page (its dock shows the core). A booted core stays
  // across navigation and draws nothing where it has no stage.
  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = layerRef.current;
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
    // core, and a coloured 3D scene has no place there anyway. No WebGL 2 at
    // all is known without a context; whether one can be made is probed
    // later, in start(), only where the core would draw.
    const forced = window.matchMedia("(forced-colors: active)").matches;
    if (forced || typeof WebGL2RenderingContext === "undefined" || webgl2 === false) {
      markCore("off");
      return () => {
        reducedQuery.removeEventListener("change", onReduced);
        markCore("pending");
      };
    }

    let cancelled = false;
    let scheduled = false;
    let started = false;
    let importFailures = 0;
    let drawn = false;
    let core: Core | null = null;
    const cleanups: (() => void)[] = [];
    // Older Safari has no requestIdleCallback.
    const hasIdle = typeof (window as Partial<Window>).requestIdleCallback === "function";
    let idle = 0;
    let timeout = 0;

    function updateHidden() {
      if (!core) return;
      core.inputs.hidden =
        document.hidden ||
        document.querySelector("dialog.copilot-dialog[open]") !== null;
      core.wake();
    }

    function listenForDpr() {
      // Zoom or a move to another display changes the pixel ratio.
      const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      const onChange = () => {
        core?.resize();
        stagingFns.current.measure();
        listenForDpr();
      };
      query.addEventListener("change", onChange, { once: true });
      cleanups.push(() => query.removeEventListener("change", onChange));
    }

    function start() {
      if (started || cancelled) return;
      started = true;
      // A GPU or driver that cannot make a context: no download, no core.
      if (!supportsWebGL2()) {
        markCore("off");
        return;
      }
      loadRenderer()
        .then(({ createCore }) => {
          if (cancelled || !canvas) return;
          core = createCore(
            canvas,
            LAYOUT,
            () => {
              drawn = true;
              setReady(true);
              markCore("on");
            },
            undefined,
            (dt, wallDt) => stagingFns.current.tick(dt, wallDt),
            { neural: readNeuralMode() },
          );
          coreRef.current = core;
          core.setColors(readColors());
          core.inputs.glow.set(glowRef.current);
          core.inputs.section.set(sectionRef.current);
          core.inputs.still = stillRef.current;
          stagingFns.current.measure();
          // Plan the pixel ratio for the stage just measured.
          core.resize();
          updateHidden();
          // The window's dock may take the core from now on.
          markCore("ready");

          document.addEventListener("visibilitychange", updateHidden);
          cleanups.push(() => document.removeEventListener("visibilitychange", updateHidden));
          listenForDpr();

          // three keeps the scene and restores it after a context loss. While
          // the GPU is away the canvas is hidden and the dock goes back to
          // the 2D lattice; both come back on restore.
          const onLost = () => {
            setReady(false);
            markCore("lost");
          };
          const onRestored = () => {
            core?.resize();
            stagingFns.current.measure();
            setReady(true);
            markCore(drawn ? "on" : "ready");
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
          // drawing buffer, and the core may use it up to its right edge.
          const canvasObserver = new ResizeObserver(() => {
            core?.resize();
            stagingFns.current.measure();
          });
          canvasObserver.observe(canvas);
          cleanups.push(() => {
            themeObserver.disconnect();
            dialogObserver.disconnect();
            canvasObserver.disconnect();
          });
        }, () => {
          // Only the download failed (a network blip, a deploy that swapped
          // chunks): nothing was created, so a later boot may try again, as
          // the window opens or the network comes back. Until then the page
          // is "off": the hero stage stays collapsed, the dock keeps the 2D lattice.
          if (cancelled) return;
          markCore("off");
          importFailures++;
          if (importFailures > MAX_IMPORT_RETRIES) return; // latched: started stays true
          started = false;
          scheduled = false;
          const onOnline = () => boot();
          window.addEventListener("online", onOnline, { once: true });
          cleanups.push(() => window.removeEventListener("online", onOnline));
        })
        .catch(() => {
          // The core could not be made (no context, a GPU error): the page is
          // complete without it; it just stops promising one. No retry.
          if (!cancelled) markCore("off");
        });
    }

    /** At idle where there is a hero stage; `now` (the window opened): at once, anywhere. */
    function boot(now = false) {
      if (cancelled || started) return;
      if (now) {
        if (hasIdle) window.cancelIdleCallback(idle);
        window.clearTimeout(timeout);
        start();
        return;
      }
      if (scheduled || !document.querySelector(STAGE)) return;
      scheduled = true;
      if (hasIdle) idle = window.requestIdleCallback(start, { timeout: 1200 });
      else timeout = window.setTimeout(start, 200);
    }
    bootRef.current = boot;
    boot();

    return () => {
      cancelled = true;
      bootRef.current = null;
      if (hasIdle) window.cancelIdleCallback(idle);
      window.clearTimeout(timeout);
      reducedQuery.removeEventListener("change", onReduced);
      cleanups.forEach((cleanup) => cleanup());
      core?.dispose();
      coreRef.current = null;
      if (layer) delete layer.dataset.over;
      // A remount (Strict Mode, Fast Refresh) boots afresh and reports again.
      markCore("pending");
    };
  }, []);

  // The laptop window opening or closing flies the core (the staging sees
  // the dock appear or go). Opening boots the renderer if this page has not.
  useEffect(() => {
    windowOpenRef.current = windowOpen;
    if (windowOpen) bootRef.current?.(true);
    stagingFns.current.frame();
  }, [windowOpen]);

  // After client navigation: drop any hover left over from the page before,
  // then stage the new page's hero (or none), watch its stage and copy
  // column for layout changes, and boot if it is the first page with one.
  useEffect(() => {
    if (coreRef.current) coreRef.current.inputs.hover = -1;
    document.documentElement.classList.remove("core-hover");
    let layoutObserver: ResizeObserver | null = null;
    // After the new page has been laid out.
    const frame = requestAnimationFrame(() => {
      setTip(null);
      // The launcher's capsule too: its width (web font, label) is part of
      // the hero's keep-out, and a fixed element never resizes the body.
      const watched = document.querySelectorAll(`${STAGE}, ${COPY}, ${LAUNCHER_CHIP}`);
      if (watched.length > 0) {
        layoutObserver = new ResizeObserver(() => stagingFns.current.measure());
        watched.forEach((element) => layoutObserver?.observe(element));
      }
      stagingFns.current.measure();
      bootRef.current?.();
      // Re-hover under a pointer that has not moved.
      window.dispatchEvent(new Event("scroll"));
    });
    return () => {
      cancelAnimationFrame(frame);
      layoutObserver?.disconnect();
    };
  }, [pathname]);

  // Mouse only: lean the camera, and where the core is (the hero's open
  // space, the window's dock), hover a prism to name its note and click to
  // ask about it.
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    let last: { x: number; y: number } | null = null;
    let down: { x: number; y: number; inSpace: boolean } | null = null;
    // The ask waits out the double-click interval, so a double-click asks nothing.
    let pending = 0;
    // Escape hides the tooltip for this prism until the pointer moves to another.
    let dismissed = -1;

    // The tooltip moves with the pointer by a style write, not a render:
    // React re-renders only when what it shows changes (the note, its
    // layer, its side). `transform`, so the CSS `translate` offsets compose.
    function placeTip(x: number, y: number) {
      tipAt.current = { x, y };
      const el = tipRef.current;
      if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }

    function setHover(index: number, x = 0, y = 0) {
      const core = coreRef.current;
      if (core && core.inputs.hover !== index) {
        core.inputs.hover = index;
        core.wake();
      }
      document.documentElement.classList.toggle("core-hover", index >= 0);
      if (index < 0) {
        setTip(null);
        return;
      }
      placeTip(x, y);
      // Over the window when the core is docked there.
      const over = core ? overWindow(core.inputs.presence.kind) : false;
      const flip = x > window.innerWidth - TIP_FLIP_PX;
      setTip((prev) =>
        prev && prev.index === index && prev.over === over && prev.flip === flip
          ? prev
          : { index, title: shortTitle(knowledgeBase[index]), over, flip },
      );
    }

    function updateHover(x: number, y: number, target: EventTarget | null) {
      const core = coreRef.current;
      if (!core) {
        setHover(-1);
        return;
      }
      let index = inCoreSpace(target) ? core.pick(x, y) : -1;
      if (dismissed >= 0 && index !== dismissed) dismissed = -1;
      if (index === dismissed) index = -1;
      setHover(index, x, y);
    }

    function onMove(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      const core = coreRef.current;
      if (core) {
        // A new object each move: the renderer aims the magnetic lift only
        // while this is the pointer its last pick saw.
        core.inputs.pointer = {
          x: (event.clientX / window.innerWidth) * 2 - 1,
          y: (event.clientY / window.innerHeight) * 2 - 1,
        };
        core.wake();
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
          ? { x: event.clientX, y: event.clientY, inSpace: inCoreSpace(event.target) }
          : null;
    }

    function onClick(event: MouseEvent) {
      const core = coreRef.current;
      const start = down;
      down = null;
      // Only a plain single click that started and ended where the core is.
      if (!core || !start?.inSpace || event.detail !== 1) return;
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (!inCoreSpace(event.target)) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      const index = core.pick(event.clientX, event.clientY);
      if (index < 0) return;
      // The note dips under the click and ripples out (the renderer sends
      // the click's ripple itself); the dip lands inside the wait below.
      core.press(index);
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

  // A tooltip just shown takes the pointer's place before it paints.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (el) el.style.transform = `translate3d(${tipAt.current.x}px, ${tipAt.current.y}px, 0)`;
  }, [tip]);

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
          ref={tipRef}
          className="core-tip"
          style={{ left: 0, top: 0 }}
          data-over={tip.over ? "true" : undefined}
          data-flip={tip.flip ? "true" : undefined}
          aria-hidden="true"
        >
          <span className="font-semibold">{tip.title}</span>
          <span className="text-muted">Click to ask the copilot. Esc hides this.</span>
        </div>
      ) : null}
    </>
  );
}
