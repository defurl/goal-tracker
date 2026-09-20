/**
 * capture:states — Playwright screenshots of every named scene state.
 *
 * design-system/10-tech-stack.md names this one of the two scripts that "kept
 * the design honest across five phases": it gives reviewers a diffable visual
 * record instead of "looks fine on my machine". CLAUDE.md non-negotiable 7
 * requires a screenshot attached to any change that emits or blocks light, and
 * this is what produces it.
 *
 * Captures are committed (see .gitignore) — they are the review record.
 *
 * **Capture against a production build, not `pnpm dev`.** The adaptive-FPS
 * detector trips on a dev build and disables bloom, so a capture taken from
 * `pnpm dev` is an effects-OFF frame wearing an effects-ON label. Measured: the
 * keyboard reads 15.4% of the lamp pool from dev and 20.4% from `pnpm start`,
 * while the reduced-motion frames — where bloom is off either way — agree
 * exactly. CI captures from `pnpm start` for this reason.
 *
 * Usage:
 *   pnpm build && pnpm start       in one terminal
 *   pnpm capture:states            writes captures/local/
 *   pnpm capture:states <label>    writes captures/<label>/
 *
 * CAPTURE_BASE_URL overrides the default http://localhost:3000.
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';

const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000';
const LABEL = process.argv[2] ?? 'local';
const OUT_DIR = join(process.cwd(), 'captures', LABEL);

interface SceneState {
  name: string;
  route: string;
  viewport: { width: number; height: number };
  /** 03-motion.md: under reduced motion ambient motion is REMOVED, not slowed. */
  reducedMotion?: boolean;
}

/**
 * Every named state the room can be in right now. Add one here when a state is
 * added to the scene — a state with no capture is a state nobody reviewed.
 */
const STATES: SceneState[] = [
  { name: 'room-rest-desktop', route: '/', viewport: { width: 1600, height: 1000 } },
  { name: 'room-rest-desktop-reduced-motion', route: '/', viewport: { width: 1600, height: 1000 }, reducedMotion: true },
  { name: 'room-rest-mobile', route: '/', viewport: { width: 390, height: 844 } },
  { name: 'text-surface-desktop', route: '/text', viewport: { width: 1600, height: 1000 } },
  { name: 'text-surface-mobile', route: '/text', viewport: { width: 390, height: 844 } },
];

/** Long enough for the 2200 ms camera glide plus a few settled frames. */
const SETTLE_MS = 3000;

async function capture(browser: Browser, state: SceneState): Promise<void> {
  const context = await browser.newContext({
    viewport: state.viewport,
    deviceScaleFactor: 1,
    reducedMotion: state.reducedMotion ? 'reduce' : 'no-preference',
    colorScheme: 'dark', // D-03: there is no light mode to capture.
  });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  // Any 4xx/5xx fails the capture. A bare "failed to load resource" console
  // line does not say WHICH resource, which makes that unactionable, so record
  // the URL instead.
  page.on('response', (r) => {
    if (r.status() >= 400) {
      errors.push(`${r.status()} ${r.url()}`);
    }
  });
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() !== 'error') return;
    // Resource failures are reported from the response handler above, with the
    // URL attached. Dropping the duplicate keeps the output readable.
    if (text.includes('Failed to load resource')) return;
    errors.push(text);
  });

  await page.goto(`${BASE_URL}${state.route}`, { waitUntil: 'networkidle' });

  // The room states must have a canvas that actually got sized. R3F leaves it
  // at the 300x150 default until its parent measures non-zero, and a capture of
  // an unsized canvas is a black rectangle that looks like a lighting bug.
  if (state.route === '/') {
    await page.waitForFunction(
      () => {
        const c = document.querySelector('canvas');
        return !!c && c.width > 300;
      },
      undefined,
      { timeout: 15000 },
    );
  }

  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: join(OUT_DIR, `${state.name}.png`) });

  if (errors.length > 0) {
    console.error(`  ${state.name}: ${errors.length} console error(s)`);
    for (const e of errors.slice(0, 5)) console.error(`    ${e}`);
    throw new Error(`${state.name} captured with console errors`);
  }

  console.log(`  ${state.name}  ${state.viewport.width}x${state.viewport.height}`);
  await context.close();
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`capture:states -> captures/${LABEL}/  (${BASE_URL})`);

  // `channel: 'chromium'` selects the full headless browser rather than
  // chrome-headless-shell, which Playwright would otherwise default to and
  // which has no reliable WebGL — the captures would come back black. The GL
  // flags force ANGLE onto SwiftShader so this works on CI machines with no
  // GPU. Slower than hardware, and correctness is the point here, not speed.
  const browser = await chromium.launch({
    channel: 'chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const state of STATES) {
      await capture(browser, state);
    }
  } finally {
    await browser.close();
  }

  console.log(`${STATES.length} states captured.`);
}

main().catch((err) => {
  console.error(`\ncapture:states failed: ${(err as Error).message}\n`);
  console.error('Is the dev server running? `pnpm dev` in another terminal.');
  console.error("Browser missing? `pnpm exec playwright install chromium`.\n");
  process.exit(1);
});
