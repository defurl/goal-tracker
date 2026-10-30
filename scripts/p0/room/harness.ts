/**
 * P0 3D test harness — runs in the browser, outside the app (served by measure.ts).
 *
 * Plain three.js: loads the baked room GLB (meshopt), swaps every material for an
 * unlit MeshBasicMaterial carrying the baked map, shows the overview, travels the
 * camera to an anchor in 800 ms (ease in-out), then renders one settled frame,
 * blurs it once with a CSS filter, stops the render loop and lays one parchment
 * card over it. The furniture spot swaps item A and item B, mesh and shadow decal
 * together. Under prefers-reduced-motion there is no travel: a cut to the anchor's
 * blurred still.
 *
 * URL params: variant=webp|jpeg|png, room=<glb base name>, item=a|b|none,
 * stills=1 (use the AVIF stills under reduced motion), auto=<anchor>.
 * Keys: 1 Today, 2 Journal, 3 Self Care, 0 overview, s swap.
 *
 * window.P0 is the measuring API; scripts/p0/room/measure.ts drives it.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export interface AnchorCamera {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export interface FrameStats {
  frames: number;
  ms: number;
  fps: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  renderCallMsP50: number;
}

export interface RenderInfo {
  calls: number;
  triangles: number;
  textures: number;
  geometries: number;
  programs: number;
}

export interface LoadReport {
  ttffMs: number;
  fetchParseMs: number;
  firstRenderMs: number;
  glbUrl: string;
  info: RenderInfo;
  gpu: { vendor: string; renderer: string; version: string };
  maxAnisotropy: number;
}

export interface P0Api {
  ready: Promise<LoadReport>;
  anchors: () => Record<string, AnchorCamera>;
  travel: (anchor: string) => Promise<{ frames: number[]; reducedMotion: boolean; usedStill: boolean }>;
  back: (animate: boolean) => Promise<number[]>;
  view: (anchor: string) => void;
  swap: (key: 'a' | 'b' | 'none') => Promise<{ ms: number; url: string | null }>;
  measureFps: (ms: number) => Promise<FrameStats>;
  info: () => RenderInfo;
  setCard: (visible: boolean) => void;
  setBlur: (on: boolean) => void;
  cardRect: () => { x: number; y: number; width: number; height: number };
}

declare global {
  interface Window {
    P0: P0Api;
  }
}

const params = new URLSearchParams(location.search);
const VARIANT = params.get('variant') ?? 'webp';
const ROOM = params.get('room') ?? 'room';
const ITEM = params.get('item') ?? 'a';
const USE_STILLS = params.get('stills') === '1';
const TRAVEL_MS = 800;
const BLUR_PX = 18;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const still = document.getElementById('still') as HTMLImageElement;
const card = document.getElementById('card') as HTMLElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.info.autoReset = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 60);
const target = new THREE.Vector3();
const anchors: Record<string, AnchorCamera> = {};
const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

function asset(name: string): string {
  return `/assets/${VARIANT}/${name}.glb`;
}

/** Baked look: every surface unlit, its baked map in sRGB. Decals multiply. */
function unlit(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const old = mesh.material as THREE.MeshStandardMaterial;
    const map = old.map;
    if (map) {
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = maxAniso;
    }
    const decal = old.userData.decal === 'multiply' || mesh.name.endsWith('_shadow');
    const mat = new THREE.MeshBasicMaterial({
      map,
      side: old.side,
      alphaTest: old.alphaTest,
      transparent: decal,
    });
    if (decal) {
      mat.blending = THREE.MultiplyBlending;
      mat.premultipliedAlpha = true;
      mat.depthWrite = false;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -2;
      mat.polygonOffsetUnits = -2;
      mesh.renderOrder = 1;
    }
    mesh.material = mat;
    old.dispose();
  });
}

function readAnchor(obj: THREE.Object3D): void {
  const cam = obj.userData.camera as AnchorCamera | undefined;
  if (!cam) return;
  // the overview rides on an empty, cam_overview (GLTFLoader may append a de-duplicating suffix)
  const name = obj.name.startsWith('cam_overview') ? 'overview' : obj.name.replace(/^anchor_/, '');
  anchors[name] = cam;
}

function setCamera(a: AnchorCamera): void {
  camera.position.set(...a.position);
  target.set(...a.target);
  camera.fov = a.fov;
  camera.updateProjectionMatrix();
  camera.lookAt(target);
}

function render(): number {
  const t0 = performance.now();
  renderer.render(scene, camera);
  return performance.now() - t0;
}

function info(): RenderInfo {
  render();
  const i = renderer.info;
  return {
    calls: i.render.calls,
    triangles: i.render.triangles,
    textures: i.memory.textures,
    geometries: i.memory.geometries,
    programs: i.programs?.length ?? 0,
  };
}

function gpuInfo(): { vendor: string; renderer: string; version: string } {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    vendor: String(ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)),
    renderer: String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
    version: String(gl.getParameter(gl.VERSION)),
  };
}

/** Force the GPU to finish, so a timing includes the work it queued. */
function finish(): void {
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
}

const nextFrame = (): Promise<number> => new Promise((r) => requestAnimationFrame(r));

// ------------------------------------------------------------------ loop

// One requestAnimationFrame chain, owned here. three's setAnimationLoop(null), called from
// inside its own callback, re-requests a frame after the callback returns and leaves a
// second chain running; this loop requests the next frame first, so stopping always holds.
let loopFn: (() => void) | null = null;
let rafId = 0;
function tick(): void {
  if (!loopFn) return;
  rafId = requestAnimationFrame(tick);
  loopFn();
}
function setLoop(fn: (() => void) | null): void {
  cancelAnimationFrame(rafId);
  loopFn = fn;
  if (fn) rafId = requestAnimationFrame(tick);
}
function startLoop(): void {
  setLoop(() => render());
}
function stopLoop(): void {
  setLoop(null);
}

function setBlur(on: boolean): void {
  canvas.style.filter = on ? `blur(${BLUR_PX}px)` : '';
  // the blur samples past the edges; scale up a touch so the frame has no pale rim
  canvas.style.transform = on ? 'scale(1.06)' : '';
}

function setCard(visible: boolean): void {
  card.style.display = visible ? 'block' : 'none';
}

const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function animateTo(a: AnchorCamera, ms: number): Promise<number[]> {
  const fromPos = camera.position.clone();
  const fromTarget = target.clone();
  const fromFov = camera.fov;
  const toPos = new THREE.Vector3(...a.position);
  const toTarget = new THREE.Vector3(...a.target);
  const frames: number[] = [];
  stopLoop();
  return new Promise((resolve) => {
    const t0 = performance.now();
    let last = t0;
    setLoop(() => {
      const now = performance.now();
      frames.push(now - last);
      last = now;
      const k = ease(Math.min(1, (now - t0) / ms));
      camera.position.lerpVectors(fromPos, toPos, k);
      target.lerpVectors(fromTarget, toTarget, k);
      camera.fov = fromFov + (a.fov - fromFov) * k;
      camera.updateProjectionMatrix();
      camera.lookAt(target);
      render();
      if (k >= 1) {
        setLoop(null);
        frames.shift();
        resolve(frames);
      }
    });
  });
}

async function settle(): Promise<void> {
  // one settled frame, blurred once; nothing renders behind the board after this
  render();
  stopLoop();
  setBlur(true);
  setCard(true);
  await nextFrame();
}

async function travel(name: string): Promise<{ frames: number[]; reducedMotion: boolean; usedStill: boolean }> {
  const a = anchors[name];
  if (!a) throw new Error(`no anchor ${name}`);
  if (reducedMotion) {
    stopLoop();
    if (USE_STILLS) {
      // a cut to the anchor's blurred still: no camera travel, no 3D render at all
      still.src = `/assets/stills/${name}.avif`;
      try {
        await still.decode();
        still.style.display = 'block';
        canvas.style.visibility = 'hidden';
        setCard(true);
        await nextFrame();
        return { frames: [], reducedMotion, usedStill: true };
      } catch {
        still.style.display = 'none';
      }
    }
    setCamera(a);
    await settle();
    return { frames: [], reducedMotion, usedStill: false };
  }
  setCard(false);
  setBlur(false);
  const frames = await animateTo(a, TRAVEL_MS);
  await settle();
  return { frames, reducedMotion, usedStill: false };
}

async function back(animate: boolean): Promise<number[]> {
  setCard(false);
  setBlur(false);
  still.style.display = 'none';
  canvas.style.visibility = 'visible';
  const o = anchors.overview;
  if (!o) return [];
  let frames: number[] = [];
  if (animate && !reducedMotion) frames = await animateTo(o, TRAVEL_MS);
  else setCamera(o);
  startLoop();
  return frames;
}

function view(name: string): void {
  const a = anchors[name];
  if (!a) throw new Error(`no anchor ${name}`);
  setBlur(false);
  setCard(false);
  setCamera(a);
  render();
}

// ------------------------------------------------------------------ the spot

const items: Partial<Record<'a' | 'b', THREE.Object3D>> = {};
let shown: 'a' | 'b' | 'none' = 'none';

async function swap(key: 'a' | 'b' | 'none'): Promise<{ ms: number; url: string | null }> {
  const t0 = performance.now();
  let url: string | null = null;
  if (key !== 'none' && !items[key]) {
    url = asset(`item_${key}`);
    const gltf = await loader.loadAsync(url);
    unlit(gltf.scene);
    items[key] = gltf.scene;
    scene.add(gltf.scene);
  }
  for (const k of ['a', 'b'] as const) {
    const it = items[k];
    // the mesh and its shadow decal travel together
    if (it) it.visible = k === key;
  }
  shown = key;
  render();
  finish();
  return { ms: performance.now() - t0, url };
}

// ------------------------------------------------------------------ fps

function stats(intervals: number[], renderMs: number[]): FrameStats {
  const s = [...intervals].sort((x, y) => x - y);
  const r = [...renderMs].sort((x, y) => x - y);
  const q = (arr: number[], p: number): number => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))] ?? 0;
  const total = intervals.reduce((x, y) => x + y, 0);
  return {
    frames: intervals.length,
    ms: Math.round(total),
    fps: total > 0 ? +(intervals.length / (total / 1000)).toFixed(1) : 0,
    p50: +q(s, 0.5).toFixed(2),
    p95: +q(s, 0.95).toFixed(2),
    p99: +q(s, 0.99).toFixed(2),
    max: +(s[s.length - 1] ?? 0).toFixed(2),
    renderCallMsP50: +q(r, 0.5).toFixed(3),
  };
}

function measureFps(ms: number): Promise<FrameStats> {
  stopLoop();
  const intervals: number[] = [];
  const renderMs: number[] = [];
  return new Promise((resolve) => {
    const t0 = performance.now();
    let last = t0;
    let first = true;
    setLoop(() => {
      const now = performance.now();
      if (!first) intervals.push(now - last);
      first = false;
      last = now;
      renderMs.push(render());
      if (now - t0 >= ms) {
        setLoop(null);
        resolve(stats(intervals, renderMs));
      }
    });
  });
}

// ------------------------------------------------------------------ boot

async function boot(): Promise<LoadReport> {
  const t0 = performance.now();
  const url = asset(ROOM);
  const gltf = await loader.loadAsync(url);
  unlit(gltf.scene);
  gltf.scene.traverse(readAnchor);
  scene.add(gltf.scene);
  const fetchParseMs = performance.now() - t0;
  const o = anchors.overview;
  if (o) setCamera(o);
  const r0 = performance.now();
  render();
  finish();
  const firstRenderMs = performance.now() - r0;
  await nextFrame();
  const ttffMs = performance.now();
  const report: LoadReport = {
    ttffMs: Math.round(ttffMs),
    fetchParseMs: Math.round(fetchParseMs),
    firstRenderMs: Math.round(firstRenderMs),
    glbUrl: url,
    info: info(),
    gpu: gpuInfo(),
    maxAnisotropy: maxAniso,
  };
  if (ITEM === 'a' || ITEM === 'b') await swap(ITEM);
  startLoop();
  return report;
}

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  render();
});

window.addEventListener('keydown', (e) => {
  const map: Record<string, string> = { '1': 'today', '2': 'journal', '3': 'selfcare' };
  const name = map[e.key];
  if (name) void travel(name);
  else if (e.key === '0') void back(true);
  else if (e.key === 's') void swap(shown === 'a' ? 'b' : 'a');
});

const ready = boot();
window.P0 = {
  ready,
  anchors: () => anchors,
  travel,
  back,
  view,
  swap,
  measureFps,
  info,
  setCard,
  setBlur,
  cardRect: () => {
    const r = card.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  },
};

const auto = params.get('auto');
if (auto) void ready.then(() => travel(auto));
