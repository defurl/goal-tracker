/**
 * bundle:check — asserts both performance budgets from spec/01-decisions.md D-10.
 *
 *   route shell (/text, auth, dashboard chrome)   ≤ 200 KB gz   — contains no three.js
 *   the lazy 3D scene chunk                       ≤ 320 KB gz   — three + R3F + drei + scene
 *
 * D-10's consequence is the third assertion here, and it is the one most easily
 * broken: "/text must not transitively pull in three.js — assert this in CI,
 * since it is very easy to break with a careless shared type import."
 *
 * Run after `next build`.
 */

import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const NEXT_DIR = join(ROOT, '.next');

/** D-10. Both in KB gzipped. */
const SHELL_BUDGET_KB = 200;
const SCENE_BUDGET_KB = 320;

/** Routes that make up the shell. None of these may contain three.js. */
const SHELL_ROUTES = ['/text', '/'];

/** Substrings that only appear in a chunk that has bundled three.js. */
const THREE_MARKERS = ['WebGLRenderer', 'THREE.WebGLRenderer', 'three/build/three'];

type Manifest = { pages: Record<string, string[]> };

function loadManifest(): Manifest {
  const appManifest = join(NEXT_DIR, 'app-build-manifest.json');
  if (!existsSync(appManifest)) {
    console.error('bundle:check: .next/app-build-manifest.json not found — run `pnpm build` first.');
    process.exit(1);
  }
  return JSON.parse(readFileSync(appManifest, 'utf8')) as Manifest;
}

function gzKb(file: string): number {
  const full = join(NEXT_DIR, file);
  if (!existsSync(full)) return 0;
  return gzipSync(readFileSync(full)).length / 1024;
}

function containsThree(file: string): boolean {
  const full = join(NEXT_DIR, file);
  if (!existsSync(full)) return false;
  const source = readFileSync(full, 'utf8');
  return THREE_MARKERS.some((m) => source.includes(m));
}

/**
 * Manifest keys carry the route groups the URL does not: "/(app)/text/page" is
 * served at /text. Strip "(group)/" segments and the trailing "/page" to get the
 * URL back.
 */
function manifestKeyToRoute(key: string): string {
  const url = key
    .split('/')
    .filter((seg) => seg !== '' && !(seg.startsWith('(') && seg.endsWith(')')))
    .filter((seg) => seg !== 'page')
    .join('/');
  return `/${url}`;
}

function resolveRoute(manifest: Manifest, route: string): string[] {
  // The root layout's chunks load on every route and count toward the shell.
  const keys = Object.keys(manifest.pages).filter(
    (k) => k === '/layout' || manifestKeyToRoute(k) === route,
  );
  if (keys.filter((k) => k !== '/layout').length === 0) {
    console.error(
      `bundle:check: route ${route} is not in the build manifest.
` +
        '  Either the route moved or this check is silently measuring nothing — ' +
        'a budget that matches no chunks always passes.',
    );
    process.exit(1);
  }
  return keys.flatMap((k) => manifest.pages[k] ?? []);
}

function main(): void {
  const manifest = loadManifest();
  const failures: string[] = [];

  // ── 1. Shell budget ───────────────────────────────────────────────────────
  const shellChunks = new Set<string>();
  for (const route of SHELL_ROUTES) {
    for (const chunk of resolveRoute(manifest, route)) shellChunks.add(chunk);
  }

  const shellKb = [...shellChunks].reduce((sum, c) => sum + gzKb(c), 0);
  console.log(
    `shell   ${shellKb.toFixed(1)} KB gz / ${SHELL_BUDGET_KB} KB  (${shellChunks.size} chunks)`,
  );
  if (shellKb > SHELL_BUDGET_KB) {
    failures.push(`route shell is ${shellKb.toFixed(1)} KB gz, over the ${SHELL_BUDGET_KB} KB budget`);
  }

  // ── 2. Scene chunk budget ─────────────────────────────────────────────────
  const allChunks = new Set(Object.values(manifest.pages).flat());
  const sceneChunks = [...allChunks].filter(containsThree);
  const sceneKb = sceneChunks.reduce((sum, c) => sum + gzKb(c), 0);

  if (sceneChunks.length === 0) {
    console.log(`scene   not built yet — no chunk contains three.js (Phase 0)`);
  } else {
    console.log(
      `scene   ${sceneKb.toFixed(1)} KB gz / ${SCENE_BUDGET_KB} KB  (${sceneChunks.length} chunks)`,
    );
    if (sceneKb > SCENE_BUDGET_KB) {
      failures.push(`scene chunk is ${sceneKb.toFixed(1)} KB gz, over the ${SCENE_BUDGET_KB} KB budget`);
    }
  }

  // ── 3. The shell must never transitively import three.js (D-10) ───────────
  const leaked = [...shellChunks].filter(containsThree);
  if (leaked.length > 0) {
    failures.push(
      `three.js leaked into the route shell via: ${leaked.join(', ')}\n` +
        '  Never import from the scene tree in a shared module — a type-only import ' +
        'must use `import type` so it is erased.',
    );
  } else {
    console.log('shell   free of three.js');
  }

  if (failures.length > 0) {
    console.error('\nbundle:check failed (spec/01-decisions.md D-10)\n');
    for (const f of failures) console.error(`  - ${f}`);
    console.error('');
    process.exit(1);
  }

  console.log('\nbundle:check: both budgets green.');
}

main();
