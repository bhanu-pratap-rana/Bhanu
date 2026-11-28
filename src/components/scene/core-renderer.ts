// The memory core: one hexagonal prism per note the copilot can read.
// Loaded lazily after the page is interactive; nothing on the page depends
// on it. It reads a mutable `inputs` object each frame and eases toward it.
// Where it sits and how present it is come in `inputs.presence`
// (src/lib/core-stage.ts resolveCoreStage); it draws only inside the
// cluster's screen rect, and clears once when it stops drawing.

import {
  AddEquation,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CustomBlending,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  OneFactor,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Raycaster,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  ZeroFactor,
} from "three";
import {
  CorePhysics,
  createHoverLatch,
  introAt,
  introSettleTime,
  introSink,
  introWidth,
  rayHexPrism,
  rayPlaneY,
  resolveHover,
} from "@/lib/core-physics";
import {
  type CorePresence,
  ORB_HEIGHT,
  type ScissorOut,
  baseHeight,
  corePixelRatio,
  exitHeight,
  nonePresence,
  scissorBox,
} from "@/lib/core-stage";
import { ambientFrameMs, createFrameLoop } from "@/lib/core-loop";
import {
  NEURAL,
  afterglow,
  burstLength,
  hiddenArrival,
  hiddenLayer,
  hop,
  idleBurstDue,
  nearestHidden,
  prismHopDelay,
  signalAlpha,
} from "@/lib/core-neural";
import { PRISM_SHADE_GLSL, SHADE } from "@/lib/core-shading";
import { approach } from "@/lib/scene-state";

export type Stage = { cx: number; cy: number; r: number };

export type CoreInputs = {
  /** Warm glow target per note: the copilot touched it. */
  glow: Float32Array;
  /** Cool highlight target per note: it lives in the section being read. */
  section: Float32Array;
  /** Hovered note, or -1. */
  hover: number;
  /**
   * Where the core is and how present it is (resolveCoreStage). Written in
   * place; the renderer follows it exactly and reads nothing else for it.
   */
  presence: CorePresence;
  /** -1..1 pointer position, for a little parallax. */
  pointer: { x: number; y: number };
  /** No time-based motion: reduced motion, or the visitor paused it. */
  still: boolean;
  /** Nothing to draw: the tab is hidden or a full-screen dialog covers it. */
  hidden: boolean;
};

export type CoreColors = {
  body: string;
  edge: string;
  mist: string;
  accent: string;
  /** Hottest centre of a lit prism top: the gradient runs hot -> accent -> rim. */
  hot: string;
  /** Lit rim and edges, a lit prism's warm dark body, the shafts and the halos. */
  rim: string;
  /** 1 on dark grounds, where light adds; 0 on light grounds. */
  additive: number;
};

export type Core = {
  inputs: CoreInputs;
  /**
   * The question orb on screen, in viewport px, as last drawn. `on` is false
   * while the orb is not showing (dark, faded out, or nothing drawn).
   */
  orbScreen: { x: number; y: number; on: boolean };
  setColors(colors: CoreColors): void;
  resize(): void;
  /**
   * Index of the note under a viewport point, or -1. With hysteresis: the
   * hovered note is kept while the point still hits it, so the note a click
   * returns is the one the tooltip showed. It also aims the magnetic lift.
   */
  pick(clientX: number, clientY: number): number;
  /** A ripple from note `fromIndex` (an answer arriving: amp 0.2 per cited note). No-op when still. */
  ripple(fromIndex: number, amp: number): void;
  /** The clicked note dips and springs back, and the click ripples outward (amp 0.3). No-op when still. */
  press(index: number): void;
  /**
   * Draw again soon: `inputs` changed. The loop sleeps while nothing moves
   * (hidden, nothing staged, settled), polling slowly (core-loop), so a missed
   * wake costs a little latency, never a frozen core.
   */
  wake(): void;
  dispose(): void;
};

const PRISM_R = 0.9;
/** Centre to flat side of a prism at full width. */
const PRISM_APOTHEM = PRISM_R * Math.cos(Math.PI / 6);
const CORE_RADIUS = 5.6; // world units the stage radius maps to
/**
 * The smallest stage radius the camera frames, in px: small enough for the
 * core to shrink into the launcher's hex (LAUNCHER_R, 24px); near and far
 * follow the camera out, so depth precision holds there too.
 */
const MIN_STAGE_R = 8;
/** Halo quad side, world units. */
const HALO_SIZE = 2 * PRISM_R;
/** Rim-coloured: a saffron bloom keeps a lit top gold where it adds (core-shading withHalo). */
const HALO_ALPHA = SHADE.HALO_ALPHA;
/** Lit notes below this glow get no halo. */
const HALO_MIN_GLOW = 0.02;
/** Shaft strength on dark grounds, lowered while halos add their light. */
const SHAFT_STRENGTH_WITH_HALOS = 0.32;
/** The plane the magnetic lift aims at when the pointer is between prisms. */
const AIM_PLANE_Y = 0.8;
/**
 * Depth range around the camera's distance to the core. Everything drawn
 * stays inside the scissor bounds below, within ~9 units of the target; a
 * tight near/far keeps the depth buffer precise when the camera is far away.
 */
const DEPTH_SPAN = 14;

/**
 * Everything drawn fits inside a cone frustum around the core's axis: the
 * visible floor ring (0.86 of its 7-unit disc) and the dust at the bottom,
 * the halos over the tallest lit prisms (outer cells reach 5.2 + 0.9) at the
 * top. It turns with the core and looks the same from every side, so its
 * screen rect, the scissor, does not change as the core drifts round.
 */
const BOUND_BOTTOM_Y = -0.6;
const BOUND_BOTTOM_R = 6.4;
const BOUND_TOP_Y = 7.6;
const BOUND_TOP_R = 6.2;
const BOUND_SAMPLES = 24;
/** Screen px around the projected bounds (antialiasing, rounding). */
const SCISSOR_MARGIN = 6;
/** Screen rect of the bounds in units of r, for the pixel budget before the first frame. */
const BOUND_RECT_W = 2.7;
const BOUND_RECT_H = 2.6;
/** The pixel ratio is re-planned only when the drawn rect's area moves this much. */
const BUDGET_SLACK = 0.12;
/** Below this the core is not drawn at all. */
const MIN_OPACITY = 0.002;

const prismVertex = /* glsl */ `
  attribute float aGlow;
  attribute float aSect;
  attribute float aHover;
  attribute float aHeight;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying float vGlow;
  varying float vSect;
  varying float vHover;
  varying float vHeight;
  void main() {
    vLocal = position;
    vGlow = aGlow;
    vSect = aSect;
    vHover = aHover;
    vHeight = aHeight;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const prismFragment = /* glsl */ `
  uniform vec3 uBody;
  uniform vec3 uEdge;
  uniform vec3 uMist;
  uniform vec3 uAccent;
  uniform vec3 uHot;
  uniform vec3 uRim;
  uniform float uAdd;
  uniform float uDim;
  uniform float uGlowScale;
  uniform float uOpacity;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying float vGlow;
  varying float vSect;
  varying float vHover;
  varying float vHeight;
  const float PI = 3.14159265;
  const float R = ${PRISM_R.toFixed(3)};

  // 0 at the centre of a flat-topped hexagon, 1 on its edge.
  float hexD(vec2 p) {
    p = abs(p);
    return max(p.y, p.x * 0.8660254 + p.y * 0.5) / (0.8660254 * R);
  }

  // The colour maths, shared with its JS mirror and tests (src/lib/core-shading.ts).
  ${PRISM_SHADE_GLSL}

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorld);
    float top = step(0.5, N.y);
    float side = 1.0 - top - step(0.5, -N.y);
    float d = hexD(vLocal.xz);

    float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.5);
    float lambert = max(dot(N, normalize(vec3(-0.45, 0.8, 0.4))), 0.0);

    // Edges: the rim of the top face and the vertical corners.
    float ang = atan(vLocal.z, vLocal.x);
    float toCorner = abs(fract(ang / (PI / 3.0) + 0.5) - 0.5) * (PI / 3.0);
    float corner = (1.0 - smoothstep(0.015, 0.06, toCorner)) * side;
    float rimTop = smoothstep(vHeight - 0.05, vHeight, vLocal.y * vHeight) * side;
    float rim = smoothstep(0.86, 0.95, d) * top;
    float edge = max(max(rim, rimTop), corner * 0.6);

    vec3 col = shadePrism(top, side, d, vLocal.y, fres, lambert, edge, vGlow, vSect, vHover);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    // The core's fade, premultiplied (the canvas is): opaque prisms still
    // hide each other by depth, so the whole core fades like one layer.
    gl_FragColor *= uOpacity;
  }
`;

const shaftVertex = /* glsl */ `
  attribute float aGlow;
  varying float vY;
  varying float vGlow;
  void main() {
    vY = position.y;
    vGlow = aGlow;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

const shaftFragment = /* glsl */ `
  uniform vec3 uRim;
  uniform float uStrength;
  varying float vY;
  varying float vGlow;
  void main() {
    // Rim colour at the base, fading to nothing as it rises.
    float a = pow(1.0 - vY, 2.2) * vGlow * uStrength;
    gl_FragColor = vec4(uRim, a);
    #include <colorspace_fragment>
  }
`;

const floorVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const floorFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying vec2 vUv;
  void main() {
    float r = distance(vUv, vec2(0.5)) * 2.0;
    float a = (1.0 - smoothstep(0.0, 1.0, r)) * uAlpha;
    float ring = (1.0 - smoothstep(0.0, 0.01, abs(r - 0.86))) * 0.35;
    gl_FragColor = vec4(uColor, a + ring * uAlpha);
    #include <colorspace_fragment>
  }
`;

// A camera-facing quad per prism: fake bloom without post-processing.
const haloVertex = /* glsl */ `
  attribute float aGlow;
  varying vec2 vUv;
  varying float vGlow;
  void main() {
    vUv = uv * 2.0 - 1.0;
    vGlow = aGlow;
    vec4 centre = viewMatrix * modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float size = length(instanceMatrix[0].xyz);
    centre.xy += position.xy * size;
    gl_Position = projectionMatrix * centre;
  }
`;

const haloFragment = /* glsl */ `
  uniform vec3 uAccent;
  uniform float uAlpha;
  varying vec2 vUv;
  varying float vGlow;
  void main() {
    float r2 = dot(vUv, vUv);
    if (r2 >= 1.0) discard;
    float f = 1.0 - r2;
    f = f * f * f;
    // Encode the colour first, then scale it: the falloff is what the eye
    // sees, and the blend (ONE, ONE; alpha ZERO, ONE) adds pure light and
    // leaves the canvas alpha alone, over the page and over the prisms.
    vec3 accent = linearToOutputTexel(vec4(uAccent, 1.0)).rgb;
    gl_FragColor = vec4(accent * (f * vGlow * uAlpha), 0.0);
  }
`;

// ---- Neural layer (the default; src/lib/core-neural.ts) -------------------
// A hidden node: an indigo sphere whose marigold core shows when active.
const nodeVertex = /* glsl */ `
  attribute float aActive;
  varying vec3 vN;
  varying vec3 vView;
  varying float vActive;
  void main() {
    vActive = aActive;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vView = -mv.xyz;
    vN = normalMatrix * mat3(instanceMatrix) * normal;
    gl_Position = projectionMatrix * mv;
  }
`;

const nodeFragment = /* glsl */ `
  uniform vec3 uEdge;
  uniform vec3 uAccent;
  uniform vec3 uHot;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vView;
  varying float vActive;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vView)));
    float core = smoothstep(0.35, 0.9, facing) * clamp(vActive, 0.0, 1.0);
    vec3 col = mix(uEdge, mix(uAccent, uHot, core * 0.6), core);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    gl_FragColor *= uOpacity;
  }
`;

/** Faint indigo of the orb -> hidden edges at rest. */
const NEURAL_IN_ALPHA = 0.2;
/** Marigold hidden -> prism edges: alpha = glow x this. */
const NEURAL_OUT_ALPHA = 0.75;
/** The second-nearest node's edge, against the nearest's. */
const NEURAL_SECOND_EDGE = 0.6;
/** Signal point size, world units (about 5px across in the 1440x900 hero). */
const NEURAL_SIGNAL_SIZE = 0.34;
/** After a burst, the nodes' flash still settles for this long, seconds. */
const NEURAL_SETTLE_S = 0.6;

type NeuralLayer = {
  objects: (InstancedMesh | LineSegments | Points)[];
  setColors(colors: CoreColors): void;
  /**
   * Before the settle check: starts a burst when the glow targets changed
   * (a new demo question, an answer) or an idle pulse is due. True while a
   * burst or its afterglow is running, so the loop keeps drawing.
   */
  plan(now: number, still: boolean, ambient: boolean, targets: Float32Array): boolean;
  /** Writes this frame's nodes, edges and signals. No allocations. */
  draw(frame: NeuralFrame): void;
  dispose(): void;
};

type NeuralFrame = {
  now: number;
  still: boolean;
  /** Eased glow per note (undimmed) and the targets it eases toward. */
  glow: Float32Array;
  targets: Float32Array;
  heights: Float32Array;
  sinks: Float32Array;
  /** The presence's glow factor (the hero exit dims it). */
  presGlow: number;
  /** How much of the layer shows: the presence's threads, the intro. */
  fade: number;
  opacity: number;
};

function createNeuralLayer(layout: { x: number; z: number }[]): NeuralLayer {
  const count = layout.length;
  const H = NEURAL.HIDDEN;
  const FAN = NEURAL.FAN_IN;
  const hidden = hiddenLayer();
  const nearest = nearestHidden(layout, hidden);
  const activity = new Float32Array(H);

  // Hidden nodes.
  const nodeGeo = new SphereGeometry(1, 16, 12);
  const nodeActive = new InstancedBufferAttribute(new Float32Array(H), 1);
  nodeActive.setUsage(DynamicDrawUsage);
  nodeGeo.setAttribute("aActive", nodeActive);
  const nodeMat = new ShaderMaterial({
    vertexShader: nodeVertex,
    fragmentShader: nodeFragment,
    uniforms: {
      uEdge: { value: new Color() },
      uAccent: { value: new Color() },
      uHot: { value: new Color() },
      uOpacity: { value: 1 },
    },
  });
  const nodes = new InstancedMesh(nodeGeo, nodeMat, H);
  nodes.instanceMatrix.setUsage(DynamicDrawUsage);
  nodes.frustumCulled = false;

  // Edges: orb -> each hidden node, then each prism -> its FAN nearest nodes.
  const EDGES = H + count * FAN;
  const edgePos = new Float32Array(EDGES * 2 * 3);
  const edgeCol = new Float32Array(EDGES * 2 * 4);
  for (let j = 0; j < H; j++) {
    edgePos.set([0, ORB_HEIGHT, 0, hidden[j * 3], hidden[j * 3 + 1], hidden[j * 3 + 2]], j * 6);
  }
  const edgeGeo = new BufferGeometry();
  edgeGeo.setAttribute("position", new BufferAttribute(edgePos, 3).setUsage(DynamicDrawUsage));
  edgeGeo.setAttribute("color", new BufferAttribute(edgeCol, 4).setUsage(DynamicDrawUsage));
  const edgeMat = new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const edges = new LineSegments(edgeGeo, edgeMat);
  edges.frustumCulled = false;
  edges.renderOrder = 1;

  // Signals: one point per edge, travelling along it during a burst.
  const sigPos = new Float32Array(EDGES * 3);
  const sigCol = new Float32Array(EDGES * 4);
  const sigGeo = new BufferGeometry();
  sigGeo.setAttribute("position", new BufferAttribute(sigPos, 3).setUsage(DynamicDrawUsage));
  sigGeo.setAttribute("color", new BufferAttribute(sigCol, 4).setUsage(DynamicDrawUsage));
  const sigMat = new PointsMaterial({
    vertexColors: true,
    size: NEURAL_SIGNAL_SIZE,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
  });
  const signals = new Points(sigGeo, sigMat);
  signals.frustumCulled = false;
  signals.renderOrder = 3;
  signals.visible = false;

  const indigo = new Color();
  const marigold = new Color();
  const spark = new Color();
  const lastTargets = new Float32Array(count);
  let burstStart = Number.NEGATIVE_INFINITY;
  let strength = 0;
  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();

  function start(now: number, k: number) {
    burstStart = now;
    strength = k;
  }

  function plan(now: number, still: boolean, ambient: boolean, targets: Float32Array): boolean {
    let changed = false;
    for (let i = 0; i < count; i++) {
      if (Math.abs(targets[i] - lastTargets[i]) > 1e-3) changed = true;
      lastTargets[i] = targets[i];
    }
    if (still) {
      // Still: static edges, no travelling signals.
      burstStart = Number.NEGATIVE_INFINITY;
      return false;
    }
    if (changed) start(now, 1);
    else if (ambient && idleBurstDue(burstStart, now)) start(now, NEURAL.IDLE_STRENGTH);
    return now - burstStart < burstLength() + NEURAL_SETTLE_S;
  }

  function setEdge(e: number, r: number, g: number, b: number, a0: number, a1: number) {
    const c = e * 8;
    edgeCol[c] = r;
    edgeCol[c + 1] = g;
    edgeCol[c + 2] = b;
    edgeCol[c + 3] = a0;
    edgeCol[c + 4] = r;
    edgeCol[c + 5] = g;
    edgeCol[c + 6] = b;
    edgeCol[c + 7] = a1;
  }

  function setSignal(e: number, x: number, y: number, z: number, a: number) {
    sigPos[e * 3] = x;
    sigPos[e * 3 + 1] = y;
    sigPos[e * 3 + 2] = z;
    const c = e * 4;
    sigCol[c] = spark.r;
    sigCol[c + 1] = spark.g;
    sigCol[c + 2] = spark.b;
    sigCol[c + 3] = a;
  }

  function draw(f: NeuralFrame) {
    const t = f.still ? -1 : f.now - burstStart;
    const live = t >= 0 && t < burstLength();
    const fade = Math.max(0, Math.min(1, f.fade));

    // Steady activity: the brightest lit prism listening to each node.
    activity.fill(0);
    for (let i = 0; i < count; i++) {
      const g = f.glow[i] * f.presGlow;
      for (let k = 0; k < FAN; k++) {
        const j = nearest[i * FAN + k];
        if (g > activity[j]) activity[j] = g;
      }
    }

    let anySignal = false;
    for (let j = 0; j < H; j++) {
      // The node flashes as the orb's signal reaches it.
      const flash = t >= 0 ? afterglow(t - hiddenArrival(j)) * strength : 0;
      const act = Math.min(1, Math.max(activity[j], flash));
      p.set(hidden[j * 3], hidden[j * 3 + 1], hidden[j * 3 + 2]);
      s.setScalar(Math.max(1e-3, NEURAL.NODE_R * (0.8 + 0.4 * act) * fade));
      m.compose(p, q, s);
      nodes.setMatrixAt(j, m);
      nodeActive.setX(j, act);

      const u = live ? hop(t, j * NEURAL.HIDDEN_STAGGER_S) : -1;
      const flare = signalAlpha(u) * strength;
      const a = (NEURAL_IN_ALPHA + 0.5 * flare + 0.25 * act) * fade;
      setEdge(j, indigo.r, indigo.g, indigo.b, a * 0.6, a);
      const a2 = flare * fade;
      if (a2 > 0) anySignal = true;
      setSignal(
        j,
        hidden[j * 3] * Math.max(0, u),
        ORB_HEIGHT + (hidden[j * 3 + 1] - ORB_HEIGHT) * Math.max(0, u),
        hidden[j * 3 + 2] * Math.max(0, u),
        a2,
      );
    }

    for (let i = 0; i < count; i++) {
      const { x, z } = layout[i];
      const topY = f.heights[i] + f.sinks[i];
      const g = Math.min(1, f.glow[i] * f.presGlow * 1.1);
      const lit = f.targets[i] > 0;
      for (let k = 0; k < FAN; k++) {
        const j = nearest[i * FAN + k];
        const e = H + i * FAN + k;
        const o = e * 6;
        const hx = hidden[j * 3];
        const hy = hidden[j * 3 + 1];
        const hz = hidden[j * 3 + 2];
        edgePos[o] = hx;
        edgePos[o + 1] = hy;
        edgePos[o + 2] = hz;
        edgePos[o + 3] = x;
        edgePos[o + 4] = topY;
        edgePos[o + 5] = z;
        const u = live && lit ? hop(t, prismHopDelay(i, j)) : -1;
        const flare = signalAlpha(u) * strength;
        const weight = k === 0 ? 1 : NEURAL_SECOND_EDGE;
        const a = Math.min(1, (g * NEURAL_OUT_ALPHA + 0.4 * flare) * weight) * fade;
        setEdge(e, marigold.r, marigold.g, marigold.b, a * 0.5, a);
        const a2 = flare * weight * fade;
        if (a2 > 0) anySignal = true;
        const v = Math.max(0, u);
        setSignal(e, hx + (x - hx) * v, hy + (topY - hy) * v, hz + (z - hz) * v, a2);
      }
    }

    nodes.instanceMatrix.needsUpdate = true;
    nodeActive.needsUpdate = true;
    edgeGeo.attributes.position.needsUpdate = true;
    edgeGeo.attributes.color.needsUpdate = true;
    signals.visible = anySignal;
    if (anySignal) {
      sigGeo.attributes.position.needsUpdate = true;
      sigGeo.attributes.color.needsUpdate = true;
    }
    nodes.visible = fade > 0.01;
    edges.visible = fade > 0.01;
    nodeMat.uniforms.uOpacity.value = f.opacity;
    edgeMat.opacity = f.opacity;
    sigMat.opacity = f.opacity;
  }

  function setColors(colors: CoreColors) {
    (nodeMat.uniforms.uEdge.value as Color).set(colors.edge);
    (nodeMat.uniforms.uAccent.value as Color).set(colors.accent);
    (nodeMat.uniforms.uHot.value as Color).set(colors.hot);
    indigo.set(colors.edge);
    marigold.set(colors.accent);
    // Pale gold adds light on dark grounds; on light ones a deep saffron shows.
    spark.set(colors.additive ? colors.hot : colors.rim);
    sigMat.blending = colors.additive ? AdditiveBlending : NormalBlending;
  }

  function dispose() {
    nodeGeo.dispose();
    nodeMat.dispose();
    nodes.dispose();
    edgeGeo.dispose();
    edgeMat.dispose();
    sigGeo.dispose();
    sigMat.dispose();
  }

  return { objects: [nodes, edges, signals], setColors, plan, draw, dispose };
}

export type CoreOptions = {
  /**
   * The neural layer: orb -> 7 hidden nodes -> prisms, with travelling
   * signals. On unless false (MemoryCore passes false only for
   * `?core=classic`, kept for comparison): then none of it is created and
   * the direct orb -> prism threads draw instead.
   */
  neural?: boolean;
};

export function createCore(
  canvas: HTMLCanvasElement,
  layout: { x: number; z: number; ring: number }[],
  onFirstFrame: () => void,
  /** After every drawn frame (orbScreen is current), and once when drawing stops. */
  onFrame?: () => void,
  /**
   * At the start of every frame the tab shows, before the presence is read:
   * the staging writes `inputs.presence` here when it must follow something
   * frame by frame (the copilot window's dock, a flight), so the core and
   * what it follows never drift a frame apart. dt in seconds, clamped for
   * the physics; wallDt is the real time since the last frame. Returns true
   * while it needs every frame (a flight, the dock following the window).
   */
  beforeFrame?: (dt: number, wallDt: number) => boolean | void,
  options: CoreOptions = {},
): Core {
  const count = layout.length;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const fine = window.matchMedia("(pointer: fine)").matches;

  // MSAA on fine pointers at any pixel ratio: the core is a large, crisp
  // object there. Touch screens keep the cheaper path.
  const renderer = new WebGLRenderer({
    canvas,
    antialias: fine,
    alpha: true,
    powerPreference: "default",
  });
  renderer.setClearColor(0x000000, 0);
  renderer.debug.checkShaderErrors = process.env.NODE_ENV !== "production";

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 200);

  // ---- Prisms --------------------------------------------------------------
  // Non-indexed with recomputed normals: each side is flat-shaded, like a
  // real hexagonal prism, rather than smoothed like a cylinder.
  const prismGeo = new CylinderGeometry(PRISM_R, PRISM_R, 1, 6, 1, false, Math.PI / 2).toNonIndexed();
  prismGeo.computeVertexNormals();
  prismGeo.translate(0, 0.5, 0);

  const glowAttr = new InstancedBufferAttribute(new Float32Array(count), 1);
  const sectAttr = new InstancedBufferAttribute(new Float32Array(count), 1);
  const hoverAttr = new InstancedBufferAttribute(new Float32Array(count), 1);
  const heightAttr = new InstancedBufferAttribute(new Float32Array(count), 1);
  for (const attr of [glowAttr, sectAttr, hoverAttr, heightAttr]) {
    attr.setUsage(DynamicDrawUsage);
  }
  prismGeo.setAttribute("aGlow", glowAttr);
  prismGeo.setAttribute("aSect", sectAttr);
  prismGeo.setAttribute("aHover", hoverAttr);
  prismGeo.setAttribute("aHeight", heightAttr);

  const prismMat = new ShaderMaterial({
    vertexShader: prismVertex,
    fragmentShader: prismFragment,
    uniforms: {
      uBody: { value: new Color() },
      uEdge: { value: new Color() },
      uMist: { value: new Color() },
      uAccent: { value: new Color() },
      uHot: { value: new Color() },
      uRim: { value: new Color() },
      uAdd: { value: 1 },
      uDim: { value: 1 },
      uGlowScale: { value: 1 },
      uOpacity: { value: 1 },
    },
  });
  const prisms = new InstancedMesh(prismGeo, prismMat, count);
  prisms.instanceMatrix.setUsage(DynamicDrawUsage);
  prisms.frustumCulled = false;
  scene.add(prisms);

  // ---- Light shafts rising from pulled notes -------------------------------
  const shaftGeo = new CylinderGeometry(PRISM_R * 0.55, PRISM_R * 0.8, 1, 6, 1, true, Math.PI / 2);
  shaftGeo.translate(0, 0.5, 0);
  const shaftGlow = new InstancedBufferAttribute(new Float32Array(count), 1);
  shaftGlow.setUsage(DynamicDrawUsage);
  shaftGeo.setAttribute("aGlow", shaftGlow);
  const shaftMat = new ShaderMaterial({
    vertexShader: shaftVertex,
    fragmentShader: shaftFragment,
    uniforms: { uRim: { value: new Color() }, uStrength: { value: 0.5 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const shafts = new InstancedMesh(shaftGeo, shaftMat, count);
  shafts.instanceMatrix.setUsage(DynamicDrawUsage);
  shafts.frustumCulled = false;
  shafts.renderOrder = 1;
  scene.add(shafts);

  // ---- Halos over lit notes (dark grounds only) ----------------------------
  // Quads, not Points: point sizes are capped by the GPU and a point vanishes
  // whole once its centre leaves the view.
  const haloGeo = new PlaneGeometry(1, 1);
  const haloGlow = new InstancedBufferAttribute(new Float32Array(count), 1);
  haloGlow.setUsage(DynamicDrawUsage);
  haloGeo.setAttribute("aGlow", haloGlow);
  const haloMat = new ShaderMaterial({
    vertexShader: haloVertex,
    fragmentShader: haloFragment,
    uniforms: { uAccent: { value: new Color() }, uAlpha: { value: HALO_ALPHA } },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    blendEquationAlpha: AddEquation,
    blendSrcAlpha: ZeroFactor,
    blendDstAlpha: OneFactor,
  });
  const halos = new InstancedMesh(haloGeo, haloMat, count);
  halos.instanceMatrix.setUsage(DynamicDrawUsage);
  halos.frustumCulled = false;
  halos.renderOrder = 2; // after the shafts
  // Visible until setColors decides, so compileAsync below compiles it too.
  scene.add(halos);

  // ---- The question: an orb above the core, with a thread to each note -----
  const orbMat = new MeshBasicMaterial({ color: new Color(), transparent: true });
  const orb = new Mesh(new SphereGeometry(0.2, 20, 14), orbMat);
  orb.position.set(0, ORB_HEIGHT, 0);
  scene.add(orb);

  const threadPos = new Float32Array(count * 2 * 3);
  const threadCol = new Float32Array(count * 2 * 4);
  const threadGeo = new BufferGeometry();
  threadGeo.setAttribute("position", new BufferAttribute(threadPos, 3).setUsage(DynamicDrawUsage));
  threadGeo.setAttribute("color", new BufferAttribute(threadCol, 4).setUsage(DynamicDrawUsage));
  const threadMat = new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const threads = new LineSegments(threadGeo, threadMat);
  threads.frustumCulled = false;
  scene.add(threads);

  // The neural layer replaces the direct threads with a network (the
  // default; `neural: false` is the classic comparison look).
  const neural = options.neural !== false ? createNeuralLayer(layout) : null;
  if (neural) {
    threads.visible = false;
    for (const obj of neural.objects) scene.add(obj);
  }

  // ---- Floor and drifting dust --------------------------------------------
  const floorMat = new ShaderMaterial({
    vertexShader: floorVertex,
    fragmentShader: floorFragment,
    uniforms: { uColor: { value: new Color() }, uAlpha: { value: 0.18 } },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  const floor = new Mesh(new CircleGeometry(CORE_RADIUS * 1.25, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  scene.add(floor);

  // The dust drifts close around the core, inside the bounds the scissor is
  // cut from, so no mote ever winks out at the scissor's edge.
  const DUST = coarse ? 40 : 64;
  const DUST_LOW = BOUND_BOTTOM_Y + 0.1;
  const DUST_SPAN = 7.4;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const a = (i * 2.399963) % (Math.PI * 2); // golden angle, no randomness
    const rr = 1.6 + ((i * 7.31) % 1) * 3.6 + (i % 5) * 0.16; // up to 5.84
    dustPos[i * 3] = Math.cos(a) * rr;
    dustPos[i * 3 + 1] = DUST_LOW + ((i * 3.77) % DUST_SPAN);
    dustPos[i * 3 + 2] = Math.sin(a) * rr;
    dustSeed[i] = (i * 0.618) % 1;
  }
  const dustGeo = new BufferGeometry();
  // BufferAttribute, not Float32BufferAttribute: that one copies the array,
  // so the drift written into dustPos each frame would never reach the GPU.
  dustGeo.setAttribute("position", new BufferAttribute(dustPos, 3).setUsage(DynamicDrawUsage));
  const dustMat = new PointsMaterial({
    color: new Color(),
    size: 0.06,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const dust = new Points(dustGeo, dustMat);
  scene.add(dust);

  // ---- State ---------------------------------------------------------------
  const inputs: CoreInputs = {
    glow: new Float32Array(count),
    section: new Float32Array(count),
    hover: -1,
    presence: nonePresence(),
    pointer: { x: 0, y: 0 },
    still: false,
    hidden: false,
  };
  const orbScreen = { x: 0, y: 0, on: false };

  const glow = new Float32Array(count);
  const sect = new Float32Array(count);
  const hov = new Float32Array(count);
  const heights = new Float32Array(count);
  // Each prism's current sink and width, kept for the ray tests in pick().
  const sinks = new Float32Array(count);
  const widths = new Float32Array(count);
  // Written in place each frame for the neural layer (when on).
  const neuralFrame: NeuralFrame = {
    now: 0,
    still: false,
    glow,
    targets: inputs.glow,
    heights,
    sinks,
    presGlow: 1,
    fade: 1,
    opacity: 1,
  };
  const physics = new CorePhysics(
    layout.map((cell) => cell.x),
    layout.map((cell) => cell.z),
  );
  const maxRing = layout.reduce((max, cell) => Math.max(max, cell.ring), 0);
  const introEnd = introSettleTime(maxRing);
  const seeds = layout.map((_, i) => (i * 0.7548776) % 1);
  // A low skyline: taller towards the centre, varied by a fixed seed. Shared
  // with core-stage, whose dock framing is tested against it.
  const base = layout.map((cell, i) => baseHeight(i, cell.ring));

  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const target = new Vector3(0, 1.4, 0);

  let width = 1;
  let height = 1;
  let time = 0;
  let introStart: number | null = null;
  // Latched: once grown (or shown still), pausing and playing never replays the rise.
  let introDone = false;
  let last = performance.now();
  // Runs while there is something to draw, sleeps otherwise; started once
  // the shaders have compiled (wakes before then wait).
  const loop = createFrameLoop(step);
  const wake = loop.wake;
  let firstDrawn = false;
  let disposed = false;
  let az = 0.6;
  let el = 0.62;
  let dist = 30;
  // Written in place every frame: tick allocates nothing.
  const pointer = { x: 0, y: 0 };
  const stage: Stage = { cx: 0, cy: 0, r: 1 };
  // The presence factors as last drawn, to tell when they changed.
  const shown = { opacity: -1, dim: -1, glow: -1, settle: -1, orb: -1, threads: -1, dust: -1 };
  // The clip as last drawn: a clip that changes on its own (the dock's
  // visible part) must redraw, or pixels outside the new one would stay up.
  const shownClip = { on: false, left: 0, top: 0, width: 0, height: 0 };
  let halosOn = false;
  let settledFrames = 0;
  let lastDraw = 0;
  let dustDt = 0;
  // The canvas holds a drawn frame of the core (so stopping must clear it).
  let presented = false;
  // Base strengths from the theme; the core's fade multiplies them each frame.
  let shaftStrength = 0.4;
  let floorAlpha = 0.16;

  // ---- Fidelity: draw only the cluster's rect, spend the pixels there -------
  const bounds = new Float32Array(BOUND_SAMPLES * 2 * 3);
  {
    // Sampled circles sit inside the real ones; grow them to circumscribe.
    const grow = 1 / Math.cos(Math.PI / BOUND_SAMPLES);
    for (let i = 0; i < BOUND_SAMPLES; i++) {
      const a = (i / BOUND_SAMPLES) * Math.PI * 2;
      bounds.set([Math.cos(a) * BOUND_BOTTOM_R * grow, BOUND_BOTTOM_Y, Math.sin(a) * BOUND_BOTTOM_R * grow], i * 6);
      bounds.set([Math.cos(a) * BOUND_TOP_R * grow, BOUND_TOP_Y, Math.sin(a) * BOUND_TOP_R * grow], i * 6 + 3);
    }
  }
  const scissor: ScissorOut = { x: 0, y: 0, width: 0, height: 0, area: 0 };
  const bp = new Vector3();
  // The rect area the pixel ratio was planned for; 0 until there is a stage.
  let budgetArea = 0;

  function applyPixelRatio() {
    const ratio = corePixelRatio({
      dpr: window.devicePixelRatio || 1,
      coarse,
      rectArea: budgetArea,
      canvasArea: width * height,
    });
    // Setting it reallocates the drawing buffer: only when it really moves.
    if (Math.abs(ratio - renderer.getPixelRatio()) > 0.01) {
      renderer.setPixelRatio(ratio);
      settledFrames = 0;
    }
  }

  /** Before the first measured frame: the rect the stage's r will give. */
  function estimatedArea(r: number): number {
    return Math.min(width, BOUND_RECT_W * r) * BOUND_RECT_H * r;
  }

  function resize() {
    // The canvas box, not the window: a classic scrollbar makes them differ.
    width = Math.max(1, canvas.clientWidth || window.innerWidth);
    height = Math.max(1, canvas.clientHeight || window.innerHeight);
    if (budgetArea === 0 && inputs.presence.r > 0) budgetArea = estimatedArea(inputs.presence.r);
    applyPixelRatio();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    settledFrames = 0;
    wake();
  }
  resize();

  function setColors(colors: CoreColors) {
    const u = prismMat.uniforms;
    (u.uBody.value as Color).set(colors.body);
    (u.uEdge.value as Color).set(colors.edge);
    (u.uMist.value as Color).set(colors.mist);
    (u.uAccent.value as Color).set(colors.accent);
    (u.uHot.value as Color).set(colors.hot);
    (u.uRim.value as Color).set(colors.rim);
    u.uAdd.value = colors.additive;
    (shaftMat.uniforms.uRim.value as Color).set(colors.rim);
    // Halos only where light adds: on a light ground they read as stains.
    halosOn = Boolean(colors.additive);
    halos.visible = halosOn;
    (haloMat.uniforms.uAccent.value as Color).set(colors.rim);
    // With halos adding light, the shafts give some back so the peak stays put.
    shaftStrength = colors.additive ? SHAFT_STRENGTH_WITH_HALOS : 0.4;
    shaftMat.blending = colors.additive ? AdditiveBlending : NormalBlending;
    orbMat.color.set(colors.accent);
    (floorMat.uniforms.uColor.value as Color).set(colors.edge);
    floorAlpha = colors.additive ? 0.16 : 0.22;
    // The tick applies the strengths (times the core's fade) on its next draw.
    shown.opacity = -1;
    dustMat.color.set(colors.mist);
    threadColor.set(colors.accent);
    neural?.setColors(colors);
    settledFrames = 0;
    wake();
  }
  const threadColor = new Color();

  function placeCamera() {
    // Fit CORE_RADIUS world units to stage.r pixels, centred on the stage.
    const halfFov = (camera.fov * Math.PI) / 360;
    dist = (CORE_RADIUS * (height / 2)) / (Math.max(MIN_STAGE_R, stage.r) * Math.tan(halfFov));
    const a = az + pointer.x * 0.12;
    const e = el - pointer.y * 0.05;
    camera.position.set(
      target.x + dist * Math.cos(e) * Math.sin(a),
      target.y + dist * Math.sin(e),
      target.z + dist * Math.cos(e) * Math.cos(a),
    );
    camera.lookAt(target);
    // Near and far hug the core, so a far camera (a small stage) keeps the
    // depth precision where prisms meet the floor. setViewOffset applies them.
    camera.near = Math.max(0.1, dist - DEPTH_SPAN);
    camera.far = dist + DEPTH_SPAN;
    camera.setViewOffset(width, height, width / 2 - stage.cx, height / 2 - stage.cy, width, height);
    // Projections below (the scissor, the orb) need this frame's camera.
    camera.updateMatrixWorld();
  }

  /**
   * The scissor for this frame: the bounds projected with the camera as
   * placed, padded, clipped to the canvas (and to `clip`). `sinkY` lowers
   * the bottom while the intro raises prisms from under the floor. False
   * when nothing of the core is on the canvas.
   */
  function fitScissor(clip: CorePresence["clip"], sinkY: number): boolean {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < BOUND_SAMPLES * 2; i++) {
      const o = i * 3;
      const bottom = i % 2 === 0;
      bp.set(bounds[o], bounds[o + 1] + (bottom ? sinkY : 0), bounds[o + 2]).project(camera);
      const sx = ((bp.x + 1) / 2) * width;
      const sy = ((1 - bp.y) / 2) * height;
      if (sx < x0) x0 = sx;
      if (sx > x1) x1 = sx;
      if (sy < y0) y0 = sy;
      if (sy > y1) y1 = sy;
    }
    return scissorBox(scissor, x0, y0, x1, y1, width, height, clip, SCISSOR_MARGIN);
  }

  /** Stop drawing: one cleared frame, so no frozen picture of the core stays up. */
  function clearOnce() {
    orbScreen.on = false;
    if (!presented) return;
    presented = false;
    renderer.setScissorTest(false);
    renderer.clear();
    settledFrames = 0;
    onFrame?.();
  }

  // ---- Pointer aim: where the magnetic lift centres --------------------------
  // pick() records the pointer it last saw over the hero's open space. A
  // pointer that moved since without a pick (MemoryCore only picks in that
  // space) has left it, and so has one that left the page.
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const aimNdc = new Vector2();
  let aimPointer: CoreInputs["pointer"] | null = null;
  const hoverLatch = createHoverLatch();
  const onPageLeave = () => {
    aimPointer = null;
  };
  document.documentElement.addEventListener("pointerleave", onPageLeave);

  /** Distance along the raycaster's ray to prism `i` as drawn, or Infinity. */
  function rayToPrism(i: number): number {
    const { origin: o, direction: d } = raycaster.ray;
    return rayHexPrism(
      o.x, o.y, o.z, d.x, d.y, d.z,
      layout[i].x, layout[i].z,
      PRISM_APOTHEM * widths[i],
      sinks[i], sinks[i] + heights[i],
    );
  }

  /** Nearest prism on the raycaster's ray, or -1. */
  function nearestPrism(): number {
    let best = -1;
    let bestT = Infinity;
    for (let i = 0; i < count; i++) {
      const t = rayToPrism(i);
      if (t < bestT) {
        bestT = t;
        best = i;
      }
    }
    return best;
  }

  /** One raycast per drawn frame, from the latest pointer, on the camera as last drawn. */
  function updateAim(now: number, active: boolean) {
    if (!active || aimPointer === null || aimPointer !== inputs.pointer) {
      physics.release();
      return;
    }
    raycaster.setFromCamera(aimNdc, camera);
    const hit = nearestPrism();
    if (hit >= 0) {
      physics.aim(layout[hit].x, layout[hit].z, inputs.hover, now / 1000);
      return;
    }
    const { origin: o, direction: d } = raycaster.ray;
    const t = rayPlaneY(o.y, d.y, AIM_PLANE_Y);
    if (t === Infinity) physics.release();
    else physics.aim(o.x + d.x * t, o.z + d.z * t, inputs.hover, now / 1000);
  }

  /**
   * One frame. True while there is more to do next frame (drift, easing,
   * springs, a flight); false when nothing will change on its own, and the
   * loop sleeps until woken. After a sleep the clock restarts.
   */
  function step(now: number, resumed: boolean): boolean {
    if (disposed) return false;
    if (resumed) last = now;
    const wallDt = Math.max(0, (now - last) / 1000);
    const dt = Math.min(0.05, wallDt);
    last = now;
    if (inputs.hidden) return false;
    const following = beforeFrame?.(dt, wallDt) === true;

    // Where the core is and how present: nothing here knows about scroll.
    const pres = inputs.presence;
    if (pres.kind === "none" || !(pres.r > 0) || !(pres.opacity > MIN_OPACITY)) {
      clearOnce();
      return following;
    }

    const still = inputs.still;
    // Ambient motion (drift, breathing, dust) only while staged for it.
    // Otherwise the core settles and the loop stops drawing.
    const ambient = !still && pres.ambient;
    if (ambient) {
      time += dt;
      dustDt += dt; // applied on the next drawn frame, so throttling keeps speed
    }
    // Wall-clock, not frame-count: a slow device still finishes on time. The
    // clock starts with the first frame the core is staged, so a page loaded
    // below the hero still sees the core rise when it comes back.
    introStart ??= now;
    const introElapsed = (now - introStart) / 1000;
    if (still || introElapsed >= introEnd) introDone = true;

    // Ease toward the targets (with motion off, land on them). `moving` is
    // anything other than idle drift; it compares before assigning, so a
    // snap still gets the one redraw it needs.
    // Glow and section easing are slow fades: they count as change (no
    // settling) but, unlike tracked motion, may be drawn at the idle rate.
    let moving = false;
    let easing = false;
    for (let i = 0; i < count; i++) {
      const g = approach(glow[i], inputs.glow[i], 6, dt, still);
      const sc = approach(sect[i], inputs.section[i], 4, dt, still);
      const h = approach(hov[i], inputs.hover === i ? 1 : 0, 12, dt, still);
      if (Math.abs(g - glow[i]) + Math.abs(sc - sect[i]) > 1e-4) easing = true;
      if (Math.abs(h - hov[i]) > 1e-4) moving = true;
      glow[i] = g;
      sect[i] = sc;
      hov[i] = h;
    }

    // The stage follows the presence exactly: scroll-follow never lags,
    // layout changes (resize, font load) snap, and a flight (open, close) is
    // already sprung by the staging, elevation included.
    if (Math.abs(pres.cx - stage.cx) + Math.abs(pres.cy - stage.cy) + Math.abs(pres.r - stage.r) > 0.1) {
      moving = true;
    }
    stage.cx = pres.cx;
    stage.cy = pres.cy;
    stage.r = pres.r;
    const op = Math.min(1, pres.opacity);
    if (
      Math.abs(op - shown.opacity) + Math.abs(pres.dim - shown.dim) + Math.abs(pres.glow - shown.glow) +
        Math.abs(pres.settle - shown.settle) + Math.abs(pres.orb - shown.orb) +
        Math.abs(pres.threads - shown.threads) + Math.abs(pres.dust - shown.dust) > 1e-4
    ) {
      moving = true;
    }
    shown.opacity = op;
    shown.dim = pres.dim;
    shown.glow = pres.glow;
    shown.settle = pres.settle;
    shown.orb = pres.orb;
    shown.threads = pres.threads;
    shown.dust = pres.dust;
    const clip = pres.clip;
    if (
      (clip !== null) !== shownClip.on ||
      (clip !== null &&
        Math.abs(clip.left - shownClip.left) + Math.abs(clip.top - shownClip.top) +
          Math.abs(clip.width - shownClip.width) + Math.abs(clip.height - shownClip.height) > 0.1)
    ) {
      moving = true;
    }
    shownClip.on = clip !== null;
    if (clip) {
      shownClip.left = clip.left;
      shownClip.top = clip.top;
      shownClip.width = clip.width;
      shownClip.height = clip.height;
    }

    // Camera: drifts slowly on its own and leans with the pointer.
    const targetAz = 0.6 + time * 0.045;
    // Snapping with motion off keeps a stage change from becoming a swing.
    const nextAz = approach(az, targetAz, 3, dt, still);
    // Exact: a second, slower ease here would keep tilting after a flight lands.
    const nextEl = Number.isFinite(pres.el) ? pres.el : el;
    const nextPx = still ? 0 : approach(pointer.x, inputs.pointer.x, 2.5, dt);
    const nextPy = still ? 0 : approach(pointer.y, inputs.pointer.y, 2.5, dt);
    const cameraMoving =
      Math.abs(nextAz - az) + Math.abs(nextEl - el) +
        Math.abs(nextPx - pointer.x) + Math.abs(nextPy - pointer.y) > 1e-5;
    az = nextAz;
    el = nextEl;
    pointer.x = nextPx;
    pointer.y = nextPy;

    // Springs: the lift follows a fine pointer in the hero; ripples and the
    // press dip come from events. A spring in mid-bounce keeps the loop drawing.
    updateAim(now, fine && ambient && firstDrawn && pres.kind === "hero");
    if (physics.step(dt, still)) moving = true;
    // A signal burst (or its afterglow) keeps drawing, at the idle rate.
    if (neural?.plan(now / 1000, still, ambient, inputs.glow)) easing = true;

    if (!ambient && !moving && !easing && !cameraMoving && introDone && presented) {
      settledFrames++;
      // Nothing changed: skip the draw, and sleep unless something is followed.
      if (settledFrames > 2 && firstDrawn) return following;
    } else {
      settledFrames = 0;
    }
    // Idle drift (and slow fades) need no more than 60 fps, 30 on a phone or
    // in the small dock: same look, a fraction of the battery.
    if (ambient && !moving && introDone && presented && now - lastDraw < ambientFrameMs(coarse, pres.kind)) {
      return true;
    }

    let topGlow = 0;
    let lowest = 0;
    for (let i = 0; i < count; i++) {
      const { x, z, ring } = layout[i];
      // The overshoot reaches height only; width and sink stop at 1.
      const t = introDone ? 1 : introAt(introElapsed, ring, false);
      const tw = introWidth(t);
      const breathe = Math.sin(time * 0.9 + seeds[i] * 6.28) * 0.05;
      // As the hero leaves, the warm light dims and the prisms settle,
      // inner ring first, but never below the floor.
      const g = glow[i] * pres.glow;
      const h = (base[i] + g * 2.3 + sect[i] * 0.45 + hov[i] * 0.5 + breathe) * exitHeight(pres.settle, ring, maxRing);
      heights[i] = Math.max(0.05, h * t + physics.offset[i]);
      const sink = introSink(t);
      if (sink < lowest) lowest = sink;
      const w = 0.55 + 0.45 * tw;
      sinks[i] = sink;
      widths[i] = w;
      p.set(x, sink, z);
      s.set(w, heights[i], w);
      m.compose(p, q, s);
      prisms.setMatrixAt(i, m);
      // The prism gets its note's own glow (its hue) and dims the light by
      // uGlowScale: a dimmed note stays amber, only darker.
      glowAttr.setX(i, glow[i]);
      sectAttr.setX(i, sect[i]);
      hoverAttr.setX(i, hov[i]);
      heightAttr.setX(i, heights[i]);

      topGlow = Math.max(topGlow, g);
      p.set(x, heights[i] + sink, z);
      s.set(1, g * 3.4 * tw, 1);
      m.compose(p, q, s);
      shafts.setMatrixAt(i, m);
      shaftGlow.setX(i, g);

      // A halo just above the top of each lit note; none (scale 0) when dark.
      if (halosOn) {
        const lit = g * tw;
        p.set(x, heights[i] + sink + 0.15, z);
        s.setScalar(lit < HALO_MIN_GLOW ? 0 : HALO_SIZE);
        m.compose(p, q, s);
        halos.setMatrixAt(i, m);
        haloGlow.setX(i, lit);
      }

      // A thread from the question to each note it pulls (classic look only:
      // the neural layer draws its own edges, so skip the hidden buffers).
      if (neural) continue;
      const o = i * 6;
      threadPos[o] = 0;
      threadPos[o + 1] = ORB_HEIGHT;
      threadPos[o + 2] = 0;
      threadPos[o + 3] = x;
      threadPos[o + 4] = heights[i] + sink;
      threadPos[o + 5] = z;
      const c = i * 8;
      const alpha = Math.min(1, g * 1.1) * tw * pres.threads;
      for (let v = 0; v < 2; v++) {
        threadCol[c + v * 4] = threadColor.r;
        threadCol[c + v * 4 + 1] = threadColor.g;
        threadCol[c + v * 4 + 2] = threadColor.b;
        threadCol[c + v * 4 + 3] = v === 0 ? alpha * 0.25 : alpha * 0.85;
      }
    }
    prisms.instanceMatrix.needsUpdate = true;
    shafts.instanceMatrix.needsUpdate = true;
    if (halosOn) {
      halos.instanceMatrix.needsUpdate = true;
      haloGlow.needsUpdate = true;
    }
    glowAttr.needsUpdate = true;
    sectAttr.needsUpdate = true;
    hoverAttr.needsUpdate = true;
    heightAttr.needsUpdate = true;
    shaftGlow.needsUpdate = true;
    if (!neural) {
      threadGeo.attributes.position.needsUpdate = true;
      threadGeo.attributes.color.needsUpdate = true;
    }
    if (neural) {
      neuralFrame.now = now / 1000;
      neuralFrame.still = still;
      neuralFrame.presGlow = pres.glow;
      neuralFrame.fade = pres.threads * (introDone ? 1 : Math.min(1, introElapsed / introEnd));
      neuralFrame.opacity = op;
      neural.draw(neuralFrame);
    }

    // The fade is one factor on every material: the prisms write it
    // premultiplied, everything blended over them is scaled by it.
    prismMat.uniforms.uDim.value = pres.dim;
    prismMat.uniforms.uGlowScale.value = pres.glow;
    prismMat.uniforms.uOpacity.value = op;
    shaftMat.uniforms.uStrength.value = shaftStrength * op;
    haloMat.uniforms.uAlpha.value = HALO_ALPHA * op;
    floorMat.uniforms.uAlpha.value = floorAlpha * op;
    threadMat.opacity = op;
    const pulse = 1 + Math.sin(time * 3) * 0.12;
    orb.scale.setScalar(Math.max(0.001, topGlow) * pulse);
    // The question orb belongs to the question: it goes as the core settles.
    const orbAlpha = Math.min(1, topGlow * 1.4) * pres.orb * op;
    orbMat.opacity = orbAlpha;
    orb.visible = pres.orb * op > 0.01;
    dustMat.opacity = 0.5 * pres.dust * op;
    dust.visible = pres.dust > 0;

    if (ambient) {
      for (let i = 0; i < DUST; i++) {
        let y = dustPos[i * 3 + 1] + dustDt * (0.12 + dustSeed[i] * 0.2);
        if (y > DUST_LOW + DUST_SPAN) y -= DUST_SPAN;
        dustPos[i * 3 + 1] = y;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dustDt = 0;
    }

    placeCamera();
    // Only the cluster's rect is drawn; off the canvas there is nothing to draw.
    if (!fitScissor(pres.clip, lowest)) {
      clearOnce();
      return following;
    }
    // Spend the pixel budget on that rect. Planned again only when its size
    // really changes (a new stage r, a resize), never while scrolling, nor
    // in mid-flight (a new ratio reallocates the buffer), and measured once
    // the intro has stopped lowering the bottom.
    const area = introDone ? scissor.area : estimatedArea(stage.r);
    if (
      budgetArea === 0 ||
      (pres.kind !== "flight" && Math.abs(area - budgetArea) > BUDGET_SLACK * budgetArea)
    ) {
      budgetArea = area;
      applyPixelRatio();
    }
    renderer.setScissor(scissor.x, scissor.y, scissor.width, scissor.height);
    renderer.setScissorTest(true);
    renderer.render(scene, camera);
    presented = true;
    lastDraw = now;

    bp.set(0, ORB_HEIGHT, 0).project(camera);
    orbScreen.x = ((bp.x + 1) / 2) * width;
    orbScreen.y = ((1 - bp.y) / 2) * height;
    orbScreen.on = orb.visible && orbAlpha > 0.05;

    if (!firstDrawn) {
      firstDrawn = true;
      onFirstFrame();
    }
    onFrame?.();
    return true;
  }

  // Compile the shaders off the main thread where the browser allows it, so
  // the first frame is not a long task under the visitor's first tap.
  // Without the extension three compiles synchronously anyway (and warns).
  const compiled = renderer.extensions.has("KHR_parallel_shader_compile")
    ? renderer.compileAsync(scene, camera).catch(() => undefined)
    : Promise.resolve();
  void compiled.finally(() => {
    loop.start();
  });

  function pick(clientX: number, clientY: number): number {
    // Nothing on screen to point at.
    if (!firstDrawn || !presented) return -1;
    const box = canvas.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return -1;
    ndc.set(((clientX - box.left) / box.width) * 2 - 1, -((clientY - box.top) / box.height) * 2 + 1);
    // The next drawn frame aims the lift from here.
    aimNdc.copy(ndc);
    aimPointer = inputs.pointer;
    // Tested against the prisms as last drawn (the camera and heights the
    // visitor sees), exactly, without three's per-hit allocations.
    raycaster.setFromCamera(ndc, camera);
    const first = nearestPrism();
    const current = hoverLatch.current;
    const hitsCurrent = current >= 0 && current < count && rayToPrism(current) < Infinity;
    return resolveHover(hoverLatch, first, hitsCurrent, performance.now());
  }

  function ripple(fromIndex: number, amp: number) {
    // Not while still, nor while nothing is drawn (it would play out later).
    if (inputs.still || !presented) return;
    physics.ripple(fromIndex, amp);
    settledFrames = 0;
    wake();
  }

  function press(index: number) {
    if (inputs.still || !presented) return;
    physics.press(index);
    settledFrames = 0;
    wake();
  }

  function dispose() {
    disposed = true;
    loop.dispose();
    document.documentElement.removeEventListener("pointerleave", onPageLeave);
    for (const obj of [prisms, shafts, halos, orb, threads, floor, dust]) {
      obj.geometry.dispose();
    }
    prisms.dispose();
    shafts.dispose();
    halos.dispose();
    for (const mat of [prismMat, shaftMat, haloMat, orbMat, threadMat, floorMat, dustMat]) {
      mat.dispose();
    }
    neural?.dispose();
    renderer.dispose();
  }

  return { inputs, orbScreen, setColors, resize, pick, ripple, press, wake, dispose };
}
