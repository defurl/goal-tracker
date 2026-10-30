/**
 * P0 3D test — measure the baked stand-in room against design-system/v2/05-room.md.
 *
 * Serves scripts/p0/room/harness.ts (types stripped), three.js from node_modules
 * and the compressed GLBs from .p0/out on a tiny localhost server, drives the
 * harness with Playwright's Chromium on the real GPU (ANGLE / D3D11), and writes
 * captures/p0/room/report.json plus five screenshots:
 *
 *   overview.png               the overview, item A in its spot
 *   today-blurred-card.png     Today settled, blurred, one parchment card
 *   swap-a.png, swap-b.png     the Self Care view with item A, then item B
 *   reduced-motion.png         reduced motion: a cut to Today's blurred still
 *
 * Measures first-view bytes, per-texture bytes, draw calls and triangles, frame
 * rate at the overview (10 s) and during travel, time to first frame, the AVIF
 * poster and anchor stills, an estimate of GPU texture memory, and the same under
 * 4x CPU throttling (a rough proxy only: no Android device here). Then runs
 * acceptance.py (Blender's Python, stdlib only) for clipping and contrast.
 *
 * Prereqs: build_room.py, then pipeline.ts. Usage: node scripts/p0/room/measure.ts
 */

import { execFileSync } from 'node:child_process';
import { createServer, type ServerResponse } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { cpus, totalmem } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { AnchorCamera, FrameStats, LoadReport, P0Api, RenderInfo, TextureReport } from './harness.ts';

const ROOT = process.cwd();
const OUT = join(ROOT, '.p0', 'out');
const CAP = join(ROOT, 'captures', 'p0', 'room');
const SHOTS = join(OUT, 'shots');
const STILLS = join(OUT, 'stills');
const BLENDER_PY = 'C:/Users/Admin/tools/blender/blender-4.5.15-windows-x64/4.5/python/bin/python.exe';
const DESKTOP = { width: 1920, height: 1080 };
const CAPTURE = { width: 1280, height: 720 };
const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'];
const UNCAPPED_ARGS = ['--disable-gpu-vsync', '--disable-frame-rate-limit'];
for (const d of [CAP, SHOTS, STILLS]) mkdirSync(d, { recursive: true });

// ------------------------------------------------------------------ tokens

/** A v2 colour token as "r g b", read from the contract, so no literal lives here. */
function tokenRgb(name: string): string {
  const md = readFileSync(join(ROOT, 'design-system', 'v2', '01-color.md'), 'utf8');
  const m = new RegExp('`--' + name + '`\\s*\\|\\s*`\\x23([0-9A-Fa-f]{6})`').exec(md);
  const h = m?.[1];
  if (!h) throw new Error(`token --${name} not found in design-system/v2/01-color.md`);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
}

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>P0 room</title>
<style>
:root{--surface-rgb:${tokenRgb('surface')};--ink-rgb:${tokenRgb('ink')}}
html,body{margin:0;height:100%;overflow:hidden;background:black}
canvas{display:block;width:100vw;height:100vh;transform-origin:center}
#still{position:fixed;inset:0;width:100vw;height:100vh;object-fit:cover;display:none}
#card{position:fixed;left:7%;top:16%;width:min(420px,40vw);box-sizing:border-box;padding:24px 28px;border-radius:12px;
background:rgb(var(--surface-rgb) / 0.92);color:rgb(var(--ink-rgb));font:16px/1.5 system-ui,sans-serif;display:none}
#card h2{margin:0 0 8px;font:600 22px/1.3 Georgia,serif}
#card p{margin:6px 0}
</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/examples/jsm/":"/three/examples/jsm/"}}</script>
</head><body><canvas></canvas><img id="still" alt="">
<div id="card"><h2>Today's focus</h2><p>Finish the content plan</p><p>Go for a 20-minute walk</p><p>Read 10 pages before bed</p></div>
<script type="module" src="/harness.js"></script></body></html>`;

// ------------------------------------------------------------------ server

const HARNESS_JS = stripTypeScriptTypes(readFileSync(join(ROOT, 'scripts', 'p0', 'room', 'harness.ts'), 'utf8'));
const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.avif': 'image/avif',
  '.png': 'image/png',
};
let served: { path: string; bytes: number }[] = [];

function sendFile(res: ServerResponse, base: string, rel: string): void {
  const file = normalize(join(base, decodeURIComponent(rel)));
  if (!file.startsWith(base + sep) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  const body = readFileSync(file);
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(body);
  served.push({ path: rel, bytes: body.length });
}

function serve(): Promise<{ base: string; close: () => void }> {
  const three = join(ROOT, 'node_modules', 'three');
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const p = url.pathname;
    if (p === '/harness.js') {
      res.writeHead(200, { 'content-type': MIME['.js'] ?? '', 'cache-control': 'no-store' }).end(HARNESS_JS);
    } else if (p.startsWith('/three/')) {
      sendFile(res, three, p.slice('/three/'.length));
    } else if (p.startsWith('/assets/')) {
      sendFile(res, OUT, p.slice('/assets/'.length));
    } else if (p === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(PAGE);
    } else {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, 'localhost', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ base: `http://localhost:${port}/`, close: () => server.close() });
    });
  });
}

// ------------------------------------------------------------------ page helpers

type Api = P0Api;
const api = (page: Page) => ({
  ready: () => page.evaluate(() => (window as unknown as { P0: Api }).P0.ready),
  travel: (a: string) => page.evaluate((x) => (window as unknown as { P0: Api }).P0.travel(x), a),
  back: (animate: boolean) => page.evaluate((x) => (window as unknown as { P0: Api }).P0.back(x), animate),
  view: (a: string) => page.evaluate((x) => (window as unknown as { P0: Api }).P0.view(x), a),
  swap: (k: 'a' | 'b' | 'none') => page.evaluate((x) => (window as unknown as { P0: Api }).P0.swap(x), k),
  fps: (ms: number) => page.evaluate((x) => (window as unknown as { P0: Api }).P0.measureFps(x), ms),
  info: () => page.evaluate(() => (window as unknown as { P0: Api }).P0.info()),
  anchors: () => page.evaluate(() => (window as unknown as { P0: Api }).P0.anchors()),
  card: (v: boolean) => page.evaluate((x) => (window as unknown as { P0: Api }).P0.setCard(x), v),
  cardRect: () => page.evaluate(() => (window as unknown as { P0: Api }).P0.cardRect()),
});

async function open(
  browser: Browser,
  base: string,
  query: string,
  opts: { size?: { width: number; height: number }; reduced?: boolean; throttle?: number } = {},
): Promise<{ ctx: BrowserContext; page: Page; load: LoadReport; bytes: number; files: { path: string; bytes: number }[] }> {
  const ctx = await browser.newContext({
    viewport: opts.size ?? DESKTOP,
    deviceScaleFactor: 1,
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  if (opts.throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.throttle });
  }
  served = [];
  await page.goto(`${base}?${query}`);
  await page.waitForFunction(() => 'P0' in window);
  const load = await api(page).ready();
  if (errors.length) console.warn('page errors:', errors);
  const files = served.filter((f) => f.path.endsWith('.glb'));
  return { ctx, page, load, bytes: files.reduce((s, f) => s + f.bytes, 0), files };
}

async function travelStats(page: Page, cycles: number): Promise<FrameStats> {
  const a = api(page);
  const frames: number[] = [];
  for (let i = 0; i < cycles; i++) {
    const anchor = ['today', 'journal', 'selfcare'][i % 3] ?? 'today';
    frames.push(...(await a.travel(anchor)).frames);
    frames.push(...(await a.back(true)));
  }
  const s = [...frames].sort((x, y) => x - y);
  const q = (p: number): number => +(s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0).toFixed(2);
  const total = frames.reduce((x, y) => x + y, 0);
  return {
    frames: frames.length,
    ms: Math.round(total),
    fps: +(frames.length / (total / 1000)).toFixed(1),
    p50: q(0.5),
    p95: q(0.95),
    p99: q(0.99),
    max: +(s[s.length - 1] ?? 0).toFixed(2),
    renderCallMsP50: 0,
  };
}

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
};

// ------------------------------------------------------------------ AVIF

function avif(png: string, out: string, budget: number): { crf: number; bytes: number; tried: Record<string, number> } {
  const tried: Record<string, number> = {};
  for (const crf of [24, 28, 32, 36, 40, 44, 48]) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', String(crf),
      '-b:v', '0', '-cpu-used', '4', '-pix_fmt', 'yuv420p', out]);
    const bytes = statSync(out).size;
    tried[String(crf)] = bytes;
    if (bytes <= budget) return { crf, bytes, tried };
  }
  return { crf: 48, bytes: statSync(out).size, tried };
}

// ------------------------------------------------------------------ GPU memory

interface Tex {
  name: string;
  width: number;
  height: number;
  alpha: boolean;
}
function gpuMemory(textures: Tex[]): Record<string, number> {
  const mip = 4 / 3;
  let rgba = 0;
  let etc1s = 0;
  let uastc = 0;
  for (const t of textures) {
    const px = t.width * t.height * mip;
    rgba += px * 4;
    // ETC1S transcodes to BC1 / ETC2 RGB (0.5 B/px) when opaque, BC3/BC7 / ETC2 RGBA (1 B/px) with alpha
    etc1s += px * (t.alpha ? 1 : 0.5);
    // UASTC transcodes to BC7 / ASTC 4x4: 1 B/px
    uastc += px;
  }
  return {
    uncompressedRgba8WithMipsBytes: Math.round(rgba),
    ktx2Etc1sEstimateBytes: Math.round(etc1s),
    ktx2UastcEstimateBytes: Math.round(uastc),
  };
}

// ------------------------------------------------------------------ main

interface PipelineTex {
  name: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  psnrVsPng?: number;
}
interface PipelineGlb {
  bytes: number;
  gzipBytes: number;
  brotliBytes: number;
  geometryBytes: number;
  textures: PipelineTex[];
  meshes: string[];
}
type PipelineFile = { results: Record<string, Record<string, PipelineGlb>> };

async function main(): Promise<void> {
  const { base, close } = await serve();
  const report: Record<string, unknown> = { generatedAt: new Date().toISOString() };
  const pipeline = JSON.parse(readFileSync(join(OUT, 'pipeline.json'), 'utf8')) as PipelineFile;
  const has4k = existsSync(join(OUT, 'webp', 'room4k.glb'));
  const pipeline4k = has4k ? (JSON.parse(readFileSync(join(OUT, 'pipeline4k.json'), 'utf8')) as PipelineFile) : undefined;

  const capped = await chromium.launch({ headless: true, args: GPU_ARGS });
  report.browser = `Chromium ${capped.version()} (Playwright, headless)`;
  report.machine = { cpu: cpus()[0]?.model ?? '', cores: cpus().length, memGB: Math.round(totalmem() / 2 ** 30) };

  // 1. first view per variant: three cold loads each, no item placed
  const firstView: Record<string, unknown> = {};
  const rooms = has4k ? ['room', 'room4k'] : ['room'];
  for (const room of rooms) {
    for (const variant of ['webp', 'jpeg', 'png']) {
      const runs: LoadReport[] = [];
      let bytes = 0;
      const items: Record<string, { bytes: number; ms: number }> = {};
      for (let i = 0; i < 3; i++) {
        const o = await open(capped, base, `variant=${variant}&room=${room}&item=none`);
        runs.push(o.load);
        bytes = o.bytes;
        if (i === 0 && room === 'room') {
          for (const k of ['a', 'b'] as const) {
            served = [];
            const s = await api(o.page).swap(k);
            items[k] = { bytes: served.reduce((x, f) => x + f.bytes, 0), ms: Math.round(s.ms) };
          }
        }
        await o.ctx.close();
      }
      const first = runs[0];
      firstView[`${room}.${variant}`] = {
        glbBytes: bytes,
        ttffMsMedian: median(runs.map((r) => r.ttffMs)),
        ttffMsRuns: runs.map((r) => r.ttffMs),
        fetchParseMsMedian: median(runs.map((r) => r.fetchParseMs)),
        firstRenderMsMedian: median(runs.map((r) => r.firstRenderMs)),
        info: first?.info,
        ...(room === 'room' ? { itemLoads: items } : {}),
      };
      if (!report.gpu && first) report.gpu = first.gpu;
      console.log('first view', room, variant, bytes, 'B; ttff', median(runs.map((r) => r.ttffMs)), 'ms');
    }
  }
  report.firstView = firstView;

  // 1b. KTX2: WebP against ETC1S everywhere and against a UASTC shell (rest ETC1S)
  const KTX = ['webp', 'etc1s', 'uastc'];
  const ktx2: Record<string, unknown> = {};
  for (const variant of KTX) {
    const ttff: number[] = [];
    let glb = 0;
    let transcoder = 0;
    let textures: TextureReport[] = [];
    const items: Record<string, number> = {};
    let fps: FrameStats | undefined;
    for (let i = 0; i < 3; i++) {
      const o = await open(capped, base, `variant=${variant}&room=room&item=none`);
      ttff.push(o.load.ttffMs);
      glb = o.bytes;
      transcoder = served.filter((f) => f.path.includes('libs/basis/')).reduce((x, f) => x + f.bytes, 0);
      if (i === 0) {
        textures = await o.page.evaluate(() => (window as unknown as { P0: Api }).P0.textures());
        for (const k of ['a', 'b'] as const) {
          served = [];
          await api(o.page).swap(k);
          items[k] = served.filter((f) => f.path.endsWith('.glb')).reduce((x, f) => x + f.bytes, 0);
        }
        fps = await api(o.page).fps(10_000);
      }
      await o.ctx.close();
    }
    const shot = await open(capped, base, `variant=${variant}&room=room&item=a`, { size: CAPTURE });
    await shot.page.waitForTimeout(300);
    await shot.page.screenshot({ path: join(SHOTS, `ktx2-${variant}-overview.png`) });
    await api(shot.page).view('selfcare');
    await shot.page.waitForTimeout(150);
    await shot.page.screenshot({ path: join(SHOTS, `ktx2-${variant}-selfcare.png`) });
    await shot.ctx.close();
    ktx2[variant] = {
      firstViewGlbBytes: glb,
      transcoderBytes: transcoder,
      firstViewTotalBytes: glb + transcoder,
      itemBytes: items,
      ttffMsMedian: median(ttff),
      ttffMsRuns: ttff,
      gpuTextureBytesRoom: textures.reduce((x, t) => x + t.gpuBytes, 0),
      textures,
      fpsCappedOverview10s: fps,
    };
    console.log('ktx2', variant, glb, transcoder, median(ttff), textures.map((t) => t.format).join(','));
  }
  for (const variant of ['etc1s', 'uastc']) {
    const diff: Record<string, unknown> = {};
    for (const view of ['overview', 'selfcare']) {
      diff[view] = JSON.parse(execFileSync(BLENDER_PY, ['-I', join(ROOT, 'scripts', 'p0', 'room', 'acceptance.py'), '--diff',
        join(SHOTS, `ktx2-webp-${view}.png`), join(SHOTS, `ktx2-${variant}-${view}.png`)]).toString()) as unknown;
    }
    (ktx2[variant] as Record<string, unknown>).diffVsWebp = diff;
  }
  report.ktx2 = {
    note: 'KTX-Software 4.4.2 via gltf-transform 4.5.1 (etc1s defaults; uastc --level 2 --rdo --zstd 18 on the shell only). KTX2Loader transcodes to the best format the GPU offers; gpuBytes are the uploaded mip chains (RGBA8 with mips for WebP). diffVsWebp is the mean absolute 8-bit difference against the WebP render of the same view.',
    variants: ktx2,
  };

  // 2. desktop frame rate and travel (vsync-capped, as a user sees it) + poster and stills
  const main = await open(capped, base, 'variant=webp&room=room&item=a');
  const a = api(main.page);
  const infoOverview: RenderInfo = await a.info();
  const anchors: Record<string, AnchorCamera> = await a.anchors();
  const fpsCapped = await a.fps(10_000);
  const travelCapped = await travelStats(main.page, 6);
  await a.back(false);
  await main.page.waitForTimeout(300);
  await main.page.screenshot({ path: join(STILLS, 'poster.png') });
  const blurs: string[] = [];
  for (const anchor of ['today', 'journal', 'selfcare']) {
    await a.travel(anchor);
    await a.card(false);
    await main.page.waitForTimeout(200);
    const p = join(STILLS, `${anchor}.png`);
    await main.page.screenshot({ path: p });
    blurs.push(p);
    await a.back(false);
  }
  await main.ctx.close();
  console.log('fps capped', fpsCapped.fps, 'travel', travelCapped.fps);

  const stills: Record<string, unknown> = {
    poster: { size: '1920x1080', ...avif(join(STILLS, 'poster.png'), join(STILLS, 'overview.avif'), 150_000) },
  };
  for (const anchor of ['today', 'journal', 'selfcare']) {
    stills[anchor] = { size: '1920x1080', ...avif(join(STILLS, `${anchor}.png`), join(STILLS, `${anchor}.avif`), 80_000) };
  }
  report.stills = stills;

  // 3. capped-browser 4x CPU throttle: a rough proxy for a slower device's CPU (the GPU is still the RTX 2060)
  const thr = await open(capped, base, 'variant=webp&room=room&item=a', { throttle: 4 });
  const fpsThrottled = await api(thr.page).fps(10_000);
  const travelThrottled = await travelStats(thr.page, 3);
  const thrLoad = thr.load;
  await thr.ctx.close();
  const thrTtff: number[] = [thrLoad.ttffMs];
  for (let i = 0; i < 2; i++) {
    const o = await open(capped, base, 'variant=webp&room=room&item=none', { throttle: 4 });
    thrTtff.push(o.load.ttffMs);
    await o.ctx.close();
  }
  console.log('fps 4x throttled', fpsThrottled.fps, 'travel', travelThrottled.fps);

  // 4. captures at 1280x720: overview, Today blurred with its card, the swap, the sharp views for the tests
  const cap = await open(capped, base, 'variant=webp&room=room&item=a', { size: CAPTURE });
  const c = api(cap.page);
  await cap.page.waitForTimeout(300);
  await cap.page.screenshot({ path: join(SHOTS, 'overview.png') });
  const cardRects: Record<string, unknown> = {};
  for (const anchor of ['today', 'journal', 'selfcare']) {
    await c.travel(anchor);
    await cap.page.waitForTimeout(150);
    if (anchor === 'today') await cap.page.screenshot({ path: join(SHOTS, 'today-blurred-card.png') });
    cardRects[anchor] = await c.cardRect();
    await c.card(false);
    await cap.page.screenshot({ path: join(SHOTS, `${anchor}_blur.png`) });
    await c.view(anchor);
    await cap.page.waitForTimeout(100);
    await cap.page.screenshot({ path: join(SHOTS, `${anchor}_sharp.png`) });
    await c.back(false);
  }
  await c.view('selfcare');
  await c.swap('a');
  await cap.page.screenshot({ path: join(SHOTS, 'swap-a.png') });
  const swapB = await c.swap('b');
  await cap.page.screenshot({ path: join(SHOTS, 'swap-b.png') });
  await c.swap('none');
  await cap.page.screenshot({ path: join(SHOTS, 'selfcare_none.png') });
  await c.view('overview');
  await c.swap('a');
  await cap.page.screenshot({ path: join(SHOTS, 'overview_sharp.png') });
  await cap.ctx.close();
  await capped.close();

  // 5. uncapped frame rate: no vsync, no frame-rate limit, to see the headroom
  const uncapped = await chromium.launch({ headless: true, args: [...GPU_ARGS, ...UNCAPPED_ARGS] });
  const un = await open(uncapped, base, 'variant=webp&room=room&item=a');
  const fpsUncapped = await api(un.page).fps(10_000);
  const travelUncapped = await travelStats(un.page, 6);
  await un.ctx.close();
  let fpsUncapped4k: FrameStats | undefined;
  if (has4k) {
    const u4 = await open(uncapped, base, 'variant=webp&room=room4k&item=a');
    fpsUncapped4k = await api(u4.page).fps(10_000);
    await u4.ctx.close();
  }
  const ktxUncapped: Record<string, FrameStats> = {};
  for (const variant of KTX) {
    const k = await open(uncapped, base, `variant=${variant}&room=room&item=a`);
    ktxUncapped[variant] = await api(k.page).fps(5_000);
    await k.ctx.close();
  }
  (report.ktx2 as Record<string, unknown>).fpsUncappedOverview5s = ktxUncapped;
  await uncapped.close();
  console.log('fps uncapped', fpsUncapped.fps, 'travel', travelUncapped.fps);

  // 6. reduced motion: no travel, a cut to the anchor's blurred still; every anchor reachable
  const reducedBrowser = await chromium.launch({ headless: true, args: GPU_ARGS });
  const rm = await open(reducedBrowser, base, 'variant=webp&room=room&item=a&stills=1', { size: CAPTURE, reduced: true });
  const r = api(rm.page);
  const reduced: Record<string, unknown> = {};
  for (const anchor of ['journal', 'selfcare', 'today']) {
    const t = await r.travel(anchor);
    reduced[anchor] = { travelFrames: t.frames.length, usedStill: t.usedStill, reducedMotion: t.reducedMotion };
    if (anchor !== 'today') await r.back(false);
  }
  await rm.page.waitForTimeout(150);
  await rm.page.screenshot({ path: join(SHOTS, 'reduced-motion.png') });
  reduced.cardRect = await r.cardRect();
  await rm.ctx.close();
  await reducedBrowser.close();
  close();

  // 7. acceptance: clipping and contrast, computed in Python from the screenshots
  const accIn = join(OUT, 'acceptance-input.json');
  writeFileSync(accIn, JSON.stringify({
    colorDoc: join(ROOT, 'design-system', 'v2', '01-color.md'),
    cardOpacity: 0.92,
    overview: join(SHOTS, 'overview.png'),
    sharp: { today: join(SHOTS, 'today_sharp.png'), journal: join(SHOTS, 'journal_sharp.png'), selfcare: join(SHOTS, 'selfcare_sharp.png') },
    blur: { today: join(SHOTS, 'today_blur.png'), journal: join(SHOTS, 'journal_blur.png'), selfcare: join(SHOTS, 'selfcare_blur.png') },
    cards: cardRects,
    todayCard: join(SHOTS, 'today-blurred-card.png'),
    reduced: join(SHOTS, 'reduced-motion.png'),
    reducedCard: reduced.cardRect,
    swap: { a: join(SHOTS, 'swap-a.png'), b: join(SHOTS, 'swap-b.png'), none: join(SHOTS, 'selfcare_none.png') },
    reference: {
      overview: join(ROOT, '.p0', 'build', 'preview_overview_a.png'),
      selfcare: join(ROOT, '.p0', 'build', 'preview_selfcare_a.png'),
      today: join(ROOT, '.p0', 'build', 'preview_today_a.png'),
    },
    webgl: { overview: join(SHOTS, 'overview_sharp.png'), selfcare: join(SHOTS, 'swap-a.png'), today: join(SHOTS, 'today_sharp.png') },
    spot: anchors,
  }));
  const acceptance = JSON.parse(
    execFileSync(BLENDER_PY, ['-I', join(ROOT, 'scripts', 'p0', 'room', 'acceptance.py'), accIn]).toString(),
  ) as Record<string, unknown>;

  // ------------------------------------------------------------------ assemble
  const webp = pipeline.results.webp ?? {};
  const room = webp.room;
  const texList = (g: PipelineGlb | undefined): Tex[] =>
    (g?.textures ?? []).map((t) => ({ name: t.name, width: t.width, height: t.height, alpha: /foliage|item_a$/.test(t.name) }));
  const roomTex = texList(room);
  const room4kTex = texList(pipeline4k?.results.webp?.room4k);
  const itemsTex = [...texList(webp.item_a), ...texList(webp.item_b)];

  const buildStats = JSON.parse(readFileSync(join(ROOT, '.p0', 'build', 'build-stats.json'), 'utf8')) as Record<string, unknown>;
  const build4k = existsSync(join(ROOT, '.p0', 'build4k', 'build-stats.json'))
    ? (JSON.parse(readFileSync(join(ROOT, '.p0', 'build4k', 'build-stats.json'), 'utf8')) as Record<string, unknown>)
    : undefined;

  const fvWebp = firstView['room.webp'] as { glbBytes: number; ttffMsMedian: number; itemLoads: Record<string, { bytes: number }> };
  const fvJpeg = firstView['room.jpeg'] as { glbBytes: number; ttffMsMedian: number };
  const itemA = webp.item_a?.bytes ?? 0;
  const itemB = webp.item_b?.bytes ?? 0;
  const pass = (ok: boolean): string => (ok ? 'pass' : 'fail');
  const posterBytes = (stills.poster as { bytes: number }).bytes;
  const stillBytes = ['today', 'journal', 'selfcare'].map((k) => (stills[k] as { bytes: number }).bytes);

  report.build = {
    device: buildStats.device,
    triangles: { room: buildStats.triangles_room, meshes: buildStats.meshes, items: buildStats.items },
    atlases: buildStats.atlases,
    timingsSeconds: buildStats.timings_s,
    totalSeconds: buildStats.total_s,
    shell4096: build4k ? { atlases: build4k.atlases, timingsSeconds: build4k.timings_s } : null,
  };
  report.anchors = { space: 'glTF, Y up, metres; three.js PerspectiveCamera vertical fov in degrees', ...anchors };
  report.pipeline = { source: pipeline.results.source, png: pipeline.results.png, webp, jpeg: pipeline.results.jpeg, room4k: pipeline4k?.results };
  report.renderInfo = { overviewWithItemA: infoOverview, note: 'renderer.info.render after one frame at the overview' };
  report.frameRate = {
    desktopCappedOverview10s: fpsCapped,
    desktopCappedTravel: travelCapped,
    desktopUncappedOverview10s: fpsUncapped,
    desktopUncappedTravel: travelUncapped,
    desktopUncappedOverview10sShell4096: fpsUncapped4k ?? null,
    cpuThrottled4xOverview10s: fpsThrottled,
    cpuThrottled4xTravel: travelThrottled,
    viewport: '1920x1080, DPR 1',
    note: 'Capped = Chromium default frame pacing (60 Hz). Uncapped = --disable-gpu-vsync --disable-frame-rate-limit: headroom, not what a user sees. Throttled = CDP Emulation.setCPUThrottlingRate 4 on the capped browser: CPU only, the GPU is still the RTX 2060, so it is a rough proxy and not a mid-range Android.',
  };
  report.timeToFirstFrame = {
    webpMedianMs: fvWebp.ttffMsMedian,
    jpegMedianMs: fvJpeg.ttffMsMedian,
    cpuThrottled4xMs: thrTtff,
    note: 'From navigation start to the first rendered frame of the room (GLB fetched from localhost, meshopt decoded, textures decoded and uploaded). Localhost: no network time.',
  };
  report.gpuTextureMemory = {
    room2048: gpuMemory(roomTex),
    room4096Shell: room4kTex.length ? gpuMemory(room4kTex) : null,
    itemsBoth: gpuMemory(itemsTex),
    note: 'WebP/JPEG/PNG decode to RGBA8 on the GPU: about 22.4 MB per 2048 texture with mips, 89.5 MB per 4096. KTX2 figures are estimates from block sizes (ETC1S -> BC1/ETC2 at 0.5 B/px opaque, 1 B/px with alpha; UASTC -> BC7/ASTC 4x4 at 1 B/px); not measured, KTX-Software was not approved.',
  };
  report.swap = { itemBLoadMs: Math.round(swapB.ms), itemLoadsFromFirstRun: fvWebp.itemLoads };
  report.reducedMotion = reduced;
  report.acceptance = acceptance;
  report.budgets = [
    { budget: 'Room assets, first view', limit: '<= 5 MB', value: fvWebp.glbBytes, unit: 'bytes', variant: 'webp', status: pass(fvWebp.glbBytes <= 5_000_000) },
    { budget: 'Room assets, first view', limit: '<= 5 MB', value: fvJpeg.glbBytes, unit: 'bytes', variant: 'jpeg (alpha atlas stays webp)', status: pass(fvJpeg.glbBytes <= 5_000_000) },
    { budget: 'One catalogue item (A)', limit: '<= 300 KB', value: itemA, unit: 'bytes', variant: 'webp', status: pass(itemA <= 300_000) },
    { budget: 'One catalogue item (B)', limit: '<= 300 KB', value: itemB, unit: 'bytes', variant: 'webp', status: pass(itemB <= 300_000) },
    ...['etc1s', 'uastc'].flatMap((v) => {
      const k = ktx2[v] as { firstViewTotalBytes: number; itemBytes: Record<string, number> };
      return [
        { budget: 'Room assets, first view', limit: '<= 5 MB', value: k.firstViewTotalBytes, unit: 'bytes (GLB + transcoder)', variant: v === 'uastc' ? 'KTX2, UASTC shell + ETC1S' : 'KTX2 ETC1S', status: pass(k.firstViewTotalBytes <= 5_000_000) },
        ...(v === 'etc1s' ? (['a', 'b'] as const).map((i) => ({ budget: `One catalogue item (${i.toUpperCase()})`, limit: '<= 300 KB', value: k.itemBytes[i] ?? 0, unit: 'bytes', variant: 'KTX2 ETC1S', status: pass((k.itemBytes[i] ?? 1e9) <= 300_000) })) : []),
      ];
    }),
    { budget: 'Overview poster', limit: '<= 150 KB AVIF', value: posterBytes, unit: 'bytes', status: pass(posterBytes <= 150_000) },
    ...['today', 'journal', 'selfcare'].map((k, i) => ({
      budget: `Anchor still (${k})`, limit: '<= 80 KB AVIF', value: stillBytes[i], unit: 'bytes', status: pass((stillBytes[i] ?? 1e9) <= 80_000),
    })),
    { budget: 'Frame rate, desktop overview', limit: '60 fps', value: fpsCapped.fps, unit: 'fps (capped)', status: pass(fpsCapped.fps >= 58) },
    { budget: 'Frame rate, desktop travel', limit: '60 fps', value: travelCapped.fps, unit: 'fps (capped)', status: pass(travelCapped.fps >= 58) },
    { budget: 'Frame rate, mid-range Android', limit: '45 fps', value: null, unit: 'fps', status: 'n/a', note: `no device; 4x CPU-throttled desktop proxy: ${fpsThrottled.fps} fps overview, ${travelThrottled.fps} fps travel` },
    { budget: 'Scene JS chunk / route shell JS', limit: '<= 320 KB gz / <= 200 KB gz', value: null, unit: 'bytes', status: 'n/a', note: 'not measured: the harness is plain three.js outside the app, not the R3F bundle' },
  ];
  const assets = JSON.parse(readFileSync(join(CAP, 'assets.json'), 'utf8')) as { assets: { id: string; name: string; url: string; licence: string; role: string }[] };
  report.assets = {
    source: 'Poly Haven, all CC0 (full list with download URLs and authors in captures/p0/room/assets.json)',
    list: assets.assets.map((x) => ({ id: x.id, name: x.name, url: x.url, licence: x.licence, role: x.role })),
    procedural: 'walls, floor plane, ceiling, window frames, window bench, rug, mug and the open notebook are modelled by build_room.py',
  };
  report.itemSizeProbe = { note: 'item A over budget: the same GLB with a lower WebP quality or a 768 texture', ...(pipeline as unknown as { itemProbe?: object }).itemProbe };
  report.unproven = [
    'A mid-range Android: not measured. The 4x CPU throttle leaves the RTX 2060 in place; mobile GPU fill rate, thermal throttling, and texture upload on a phone are untested.',
    'KTX2 / Basis: KTX-Software was not approved, so no KTX2 files, transcoder cost (245 KB wasm) or ETC1S banding were measured; the GPU-memory gain is an estimate from block sizes.',
    "Real art: a stand-in from CC0 assets. The design team's room will differ in triangle count, texel density and how many atlases it needs.",
    'React Three Fiber and the app bundle: the harness is plain three.js outside Next.js, so the scene JS budgets (D-10) are untouched.',
    'Network: assets came from localhost. First-view bytes are real; time to first frame excludes download time (5 MB at 20 Mbit/s adds about 2 s).',
    'Acceptance criteria 1 (hotspot names and menu at 4.5:1, no hidden anchor objects) and the boards themselves: no hotspots, menu or real boards exist yet.',
  ];
  report.commands = [
    'C:/Users/Admin/tools/blender/blender-4.5.15-windows-x64/4.5/python/bin/python.exe -I scripts/p0/room/fetch_assets.py',
    'C:/Users/Admin/tools/blender/blender-4.5.15-windows-x64/blender.exe --background --factory-startup --python scripts/p0/room/build_room.py -- --samples 256 --previews --out .p0/build',
    'C:/Users/Admin/tools/blender/blender-4.5.15-windows-x64/blender.exe --background --factory-startup --python scripts/p0/room/build_room.py -- --samples 256 --shell-size 4096 --out .p0/build4k',
    'node scripts/p0/room/pipeline.ts --in .p0/build',
    'node scripts/p0/room/pipeline.ts --in .p0/build4k --suffix 4k',
    'node scripts/p0/room/measure.ts',
  ];
  // the committed screenshots: the five views, downscaled to 960x540 (full-size copies stay in .p0/out/shots)
  const shots = ['overview', 'today-blurred-card', 'swap-a', 'swap-b', 'reduced-motion',
    ...KTX.flatMap((v) => [`ktx2-${v}-overview`, `ktx2-${v}-selfcare`])];
  for (const n of shots) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', join(SHOTS, `${n}.png`), '-vf', 'scale=960:-1', join(CAP, `${n}.png`)]);
  }
  report.screenshots = shots.map((n) => ({
    file: `captures/p0/room/${n}.png`,
    size: '960x540 (measured at 1280x720)',
    bytes: statSync(join(CAP, `${n}.png`)).size,
  }));
  writeFileSync(join(CAP, 'report.json'), JSON.stringify(report, null, 2));
  console.log('wrote', join(CAP, 'report.json'));
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
