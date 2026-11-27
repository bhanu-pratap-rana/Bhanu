// The memory core: one hexagonal prism per note the copilot can read.
// Loaded lazily after the page is interactive; nothing on the page depends
// on it. It reads a mutable `inputs` object each frame and eases toward it.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  PerspectiveCamera,
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
} from "three";

export type Stage = { cx: number; cy: number; r: number };

export type CoreInputs = {
  /** Warm glow target per note: the copilot touched it. */
  glow: Float32Array;
  /** Cool highlight target per note: it lives in the section being read. */
  section: Float32Array;
  /** Hovered note, or -1. */
  hover: number;
  /** 0–1 through the whole page. */
  scroll: number;
  /** 0 with the hero in view, 1 once it has scrolled away. */
  hero: number;
  /** Where the core sits in the hero, in CSS pixels. */
  heroStage: Stage;
  /** Where it settles behind the rest of the page. */
  backStage: Stage;
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
  /** 1 on dark grounds, where light adds; 0 on light grounds. */
  additive: number;
};

export type Core = {
  inputs: CoreInputs;
  setColors(colors: CoreColors): void;
  resize(): void;
  /** Index of the note under a viewport point, or -1. */
  pick(clientX: number, clientY: number): number;
  dispose(): void;
};

const PRISM_R = 0.9;
const CORE_RADIUS = 5.6; // world units the stage radius maps to
const ORB_HEIGHT = 6.4;

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
  uniform float uAdd;
  uniform float uDim;
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

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorld);
    float top = step(0.5, N.y);
    float side = 1.0 - top - step(0.5, -N.y);
    float d = hexD(vLocal.xz);

    float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 2.5);
    float lambert = max(dot(N, normalize(vec3(-0.45, 0.8, 0.4))), 0.0);
    vec3 col = uBody * (0.55 + 0.75 * lambert);
    col = mix(col, uEdge, fres * 0.4);
    col *= mix(1.0, mix(0.45, 1.0, vLocal.y), side);
    col = mix(col, uEdge, top * 0.18);

    // Edges: the rim of the top face and the vertical corners.
    float ang = atan(vLocal.z, vLocal.x);
    float toCorner = abs(fract(ang / (PI / 3.0) + 0.5) - 0.5) * (PI / 3.0);
    float corner = (1.0 - smoothstep(0.015, 0.06, toCorner)) * side;
    float rimTop = smoothstep(vHeight - 0.05, vHeight, vLocal.y * vHeight) * side;
    float rim = smoothstep(0.86, 0.95, d) * top;
    float edge = max(max(rim, rimTop), corner * 0.6);

    float lift = max(max(vSect * 0.7, vGlow), vHover);
    vec3 edgeCol = mix(uEdge, uMist, max(vSect, vHover));
    edgeCol = mix(edgeCol, uAccent, vGlow);
    col = mix(col, edgeCol, edge * (0.45 + 0.55 * lift));

    // Warm light from inside a note the copilot touched.
    float inner = top * (0.45 + 0.55 * (1.0 - d)) + side * 0.4 * vLocal.y;
    col = mix(col, uAccent, clamp(vGlow * inner, 0.0, 1.0) * 0.85);
    col += uAccent * vGlow * inner * 0.35 * uAdd;
    col = mix(col, uMist, (vSect * 0.08 + vHover * 0.18) * top);

    // Behind the page the core dims, but what the copilot touched stays lit.
    col = mix(uBody * 0.6 + col * 0.4, col, mix(uDim, 1.0, vGlow * 0.7));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
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
  uniform vec3 uAccent;
  uniform float uStrength;
  varying float vY;
  varying float vGlow;
  void main() {
    float a = pow(1.0 - vY, 2.2) * vGlow * uStrength;
    gl_FragColor = vec4(uAccent, a);
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

function ease(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export function createCore(
  canvas: HTMLCanvasElement,
  layout: { x: number; z: number; ring: number }[],
  onFirstFrame: () => void,
): Core {
  const count = layout.length;
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  // On dense screens the pixels already hide jagged edges; skip MSAA there.
  const renderer = new WebGLRenderer({
    canvas,
    antialias: (window.devicePixelRatio || 1) < 1.5,
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
      uAdd: { value: 1 },
      uDim: { value: 1 },
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
    uniforms: { uAccent: { value: new Color() }, uStrength: { value: 0.5 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const shafts = new InstancedMesh(shaftGeo, shaftMat, count);
  shafts.instanceMatrix.setUsage(DynamicDrawUsage);
  shafts.frustumCulled = false;
  scene.add(shafts);

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

  const DUST = coarse ? 140 : 260;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const a = (i * 2.399963) % (Math.PI * 2); // golden angle, no randomness
    const rr = 2 + ((i * 7.31) % 1) * 12 + (i % 5);
    dustPos[i * 3] = Math.cos(a) * rr;
    dustPos[i * 3 + 1] = ((i * 3.77) % 9) - 1;
    dustPos[i * 3 + 2] = Math.sin(a) * rr;
    dustSeed[i] = (i * 0.618) % 1;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute("position", new Float32BufferAttribute(dustPos, 3).setUsage(DynamicDrawUsage));
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
    scroll: 0,
    hero: 0,
    heroStage: { cx: 0, cy: 0, r: 1 },
    backStage: { cx: 0, cy: 0, r: 1 },
    pointer: { x: 0, y: 0 },
    still: false,
    hidden: false,
  };

  const glow = new Float32Array(count);
  const sect = new Float32Array(count);
  const hov = new Float32Array(count);
  const heights = new Float32Array(count);
  const seeds = layout.map((_, i) => (i * 0.7548776) % 1);
  // A low skyline: taller towards the centre, varied by a fixed seed.
  const base = layout.map((_, i) => 0.55 + 0.9 * seeds[i] + 0.38 * (3 - Math.min(3, layout[i].ring)));

  const m = new Matrix4();
  const q = new Quaternion();
  const s = new Vector3();
  const p = new Vector3();
  const target = new Vector3(0, 1.4, 0);

  let width = 1;
  let height = 1;
  let time = 0;
  let intro = 0;
  let introStart: number | null = null;
  let last = performance.now();
  let frame = 0;
  let firstDrawn = false;
  let disposed = false;
  let az = 0.6;
  let el = 0.62;
  let dist = 30;
  let pointer = { x: 0, y: 0 };
  let stage: Stage = { cx: 0, cy: 0, r: 1 };
  let dim = 1;
  let settledFrames = 0;
  let lastDraw = 0;
  let dustDt = 0;

  function resize() {
    // The canvas box, not the window: a classic scrollbar makes them differ.
    width = Math.max(1, canvas.clientWidth || window.innerWidth);
    height = Math.max(1, canvas.clientHeight || window.innerHeight);
    // Cap the pixel count too, so a 5K display does not fill 15 million pixels.
    const budget = coarse ? 1.2e6 : 3e6;
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75, Math.sqrt(budget / (width * height))),
    );
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    settledFrames = 0;
  }
  resize();

  function setColors(colors: CoreColors) {
    const u = prismMat.uniforms;
    (u.uBody.value as Color).set(colors.body);
    (u.uEdge.value as Color).set(colors.edge);
    (u.uMist.value as Color).set(colors.mist);
    (u.uAccent.value as Color).set(colors.accent);
    u.uAdd.value = colors.additive;
    (shaftMat.uniforms.uAccent.value as Color).set(colors.accent);
    shaftMat.uniforms.uStrength.value = colors.additive ? 0.45 : 0.4;
    shaftMat.blending = colors.additive ? AdditiveBlending : NormalBlending;
    orbMat.color.set(colors.accent);
    (floorMat.uniforms.uColor.value as Color).set(colors.edge);
    floorMat.uniforms.uAlpha.value = colors.additive ? 0.16 : 0.22;
    dustMat.color.set(colors.mist);
    threadColor.set(colors.accent);
    settledFrames = 0;
  }
  const threadColor = new Color();

  function placeCamera() {
    // Fit CORE_RADIUS world units to stage.r pixels, centred on the stage.
    const halfFov = (camera.fov * Math.PI) / 360;
    dist = (CORE_RADIUS * (height / 2)) / (Math.max(40, stage.r) * Math.tan(halfFov));
    const a = az + pointer.x * 0.12;
    const e = el - pointer.y * 0.05;
    camera.position.set(
      target.x + dist * Math.cos(e) * Math.sin(a),
      target.y + dist * Math.sin(e),
      target.z + dist * Math.cos(e) * Math.cos(a),
    );
    camera.lookAt(target);
    camera.setViewOffset(width, height, width / 2 - stage.cx, height / 2 - stage.cy, width, height);
  }

  function tick(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (inputs.hidden) return;

    const still = inputs.still;
    // Ambient motion (drift, breathing, dust) only while the hero is on
    // screen. Behind text the core settles and the loop stops drawing.
    const ambient = !still && inputs.hero < 0.98;
    if (ambient) {
      time += dt;
      dustDt += dt; // applied on the next drawn frame, so throttling keeps speed
    }
    // Wall-clock, not frame-count: a slow device still finishes on time.
    introStart ??= now;
    // Latched: once grown, pausing and playing never replays the rise.
    intro = still ? 1 : Math.max(intro, Math.min(1, (now - introStart) / 1800));

    // Ease toward the targets. `moving` is anything other than idle drift.
    let moving = false;
    for (let i = 0; i < count; i++) {
      const g = approach(glow[i], inputs.glow[i], 6, dt);
      const sc = approach(sect[i], inputs.section[i], 4, dt);
      const h = approach(hov[i], inputs.hover === i ? 1 : 0, 12, dt);
      if (Math.abs(g - glow[i]) + Math.abs(sc - sect[i]) + Math.abs(h - hov[i]) > 1e-4) moving = true;
      glow[i] = g;
      sect[i] = sc;
      hov[i] = h;
    }

    const k = inputs.hero;
    const hs = inputs.heroStage;
    const bs = inputs.backStage;
    const nextStage = {
      cx: hs.cx + (bs.cx - hs.cx) * k,
      cy: hs.cy + (bs.cy - hs.cy) * k,
      r: hs.r + (bs.r - hs.r) * k,
    };
    if (
      Math.abs(nextStage.cx - stage.cx) + Math.abs(nextStage.cy - stage.cy) + Math.abs(nextStage.r - stage.r) >
      0.1
    ) {
      moving = true;
    }
    stage = nextStage;
    const nextDim = 1 - 0.35 * k;
    if (Math.abs(nextDim - dim) > 1e-3) moving = true;
    dim = nextDim;

    // Camera: drifts slowly on its own, turns with the scroll, leans with the pointer.
    const targetAz = 0.6 + (still ? 0 : inputs.scroll * Math.PI * 1.15) + time * 0.045;
    const targetEl = 0.62 + (still ? 0 : inputs.scroll * 0.35);
    const nextAz = approach(az, targetAz, 3, dt);
    const nextEl = approach(el, targetEl, 3, dt);
    const nextPointer = still
      ? { x: 0, y: 0 }
      : { x: approach(pointer.x, inputs.pointer.x, 2.5, dt), y: approach(pointer.y, inputs.pointer.y, 2.5, dt) };
    const cameraMoving =
      Math.abs(nextAz - az) + Math.abs(nextEl - el) +
        Math.abs(nextPointer.x - pointer.x) + Math.abs(nextPointer.y - pointer.y) > 1e-5;
    az = nextAz;
    el = nextEl;
    pointer = nextPointer;

    if (!ambient && !moving && !cameraMoving && intro >= 1) {
      settledFrames++;
      if (settledFrames > 2 && firstDrawn) return; // nothing changed: skip the draw
    } else {
      settledFrames = 0;
    }
    // Idle drift on a phone is drawn at 30 fps, not 60: same look, half the battery.
    if (ambient && coarse && !moving && intro >= 1 && now - lastDraw < 32) return;
    lastDraw = now;

    let topGlow = 0;
    for (let i = 0; i < count; i++) {
      const { x, z, ring } = layout[i];
      const t = ease((intro * 1.9 - ring * 0.22) / 1);
      const breathe = Math.sin(time * 0.9 + seeds[i] * 6.28) * 0.05;
      const h = base[i] + glow[i] * 2.3 + sect[i] * 0.45 + hov[i] * 0.5 + breathe;
      heights[i] = Math.max(0.05, h * t);
      const sink = (1 - t) * -3;
      p.set(x, sink, z);
      s.set(0.55 + 0.45 * t, heights[i], 0.55 + 0.45 * t);
      m.compose(p, q, s);
      prisms.setMatrixAt(i, m);
      glowAttr.setX(i, glow[i]);
      sectAttr.setX(i, sect[i]);
      hoverAttr.setX(i, hov[i]);
      heightAttr.setX(i, heights[i]);

      const g = glow[i];
      topGlow = Math.max(topGlow, g);
      p.set(x, heights[i] + sink, z);
      s.set(1, g * 3.4 * t, 1);
      m.compose(p, q, s);
      shafts.setMatrixAt(i, m);
      shaftGlow.setX(i, g);

      // A thread from the question to each note it pulls.
      const o = i * 6;
      threadPos[o] = 0;
      threadPos[o + 1] = ORB_HEIGHT;
      threadPos[o + 2] = 0;
      threadPos[o + 3] = x;
      threadPos[o + 4] = heights[i] + sink;
      threadPos[o + 5] = z;
      const c = i * 8;
      const alpha = Math.min(1, g * 1.1) * t * (1 - k);
      for (let v = 0; v < 2; v++) {
        threadCol[c + v * 4] = threadColor.r;
        threadCol[c + v * 4 + 1] = threadColor.g;
        threadCol[c + v * 4 + 2] = threadColor.b;
        threadCol[c + v * 4 + 3] = v === 0 ? alpha * 0.25 : alpha * 0.85;
      }
    }
    prisms.instanceMatrix.needsUpdate = true;
    shafts.instanceMatrix.needsUpdate = true;
    glowAttr.needsUpdate = true;
    sectAttr.needsUpdate = true;
    hoverAttr.needsUpdate = true;
    heightAttr.needsUpdate = true;
    shaftGlow.needsUpdate = true;
    threadGeo.attributes.position.needsUpdate = true;
    threadGeo.attributes.color.needsUpdate = true;

    prismMat.uniforms.uDim.value = dim;
    const pulse = 1 + Math.sin(time * 3) * 0.12;
    orb.scale.setScalar(Math.max(0.001, topGlow) * pulse);
    // The question orb belongs to the hero; behind text it would be a stray dot.
    orbMat.opacity = Math.min(1, topGlow * 1.4) * (1 - k);
    orb.visible = k < 0.98;
    dustMat.opacity = 0.5 * (1 - 0.5 * k);

    if (ambient) {
      for (let i = 0; i < DUST; i++) {
        let y = dustPos[i * 3 + 1] + dustDt * (0.12 + dustSeed[i] * 0.2);
        if (y > 8) y -= 9;
        dustPos[i * 3 + 1] = y;
      }
      dustGeo.attributes.position.needsUpdate = true;
      dustDt = 0;
    }

    placeCamera();
    renderer.render(scene, camera);
    if (!firstDrawn) {
      firstDrawn = true;
      onFirstFrame();
    }
  }

  // Compile the shaders off the main thread where the browser allows it, so
  // the first frame is not a long task under the visitor's first tap.
  // Without the extension three compiles synchronously anyway (and warns).
  const compiled = renderer.extensions.has("KHR_parallel_shader_compile")
    ? renderer.compileAsync(scene, camera).catch(() => undefined)
    : Promise.resolve();
  void compiled.finally(() => {
    if (!disposed) frame = requestAnimationFrame(tick);
  });

  const raycaster = new Raycaster();
  const ndc = new Vector2();

  function pick(clientX: number, clientY: number): number {
    if (!firstDrawn) return -1;
    const box = canvas.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return -1;
    ndc.set(((clientX - box.left) / box.width) * 2 - 1, -((clientY - box.top) / box.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    prisms.computeBoundingSphere();
    const hit = raycaster.intersectObject(prisms, false)[0];
    return hit?.instanceId ?? -1;
  }

  function dispose() {
    disposed = true;
    cancelAnimationFrame(frame);
    for (const obj of [prisms, shafts, orb, threads, floor, dust]) {
      obj.geometry.dispose();
    }
    prisms.dispose();
    shafts.dispose();
    for (const mat of [prismMat, shaftMat, orbMat, threadMat, floorMat, dustMat]) {
      mat.dispose();
    }
    renderer.dispose();
  }

  return { inputs, setColors, resize, pick, dispose };
}
