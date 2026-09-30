/**
 * offline:check — airplane mode, asserted (build plan 4.5).
 *
 *   1. /text, loaded once online, reloads with the network off: every section
 *      is there and nothing throws. The service worker caches the /text shell
 *      and only that (public/sw.js, B2.9).
 *   2. / cold, with the network off, lands on the /text shell rather than a
 *      browser error page — the room's 3D bundle is deliberately not cached.
 *   3. A room already open survives the network dropping: it keeps rendering
 *      and a panel still opens, from the store it already holds (spec/05 §7).
 *
 * What this cannot reach: a signed-in visitor's snapshot. That needs an
 * account, and the check runs signed out.
 *
 * Needs the production server: `pnpm build && pnpm start`, then
 * `pnpm offline:check`. CAPTURE_BASE_URL overrides http://localhost:3000.
 */

import { chromium, type Browser } from 'playwright';

const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000';
const SECTIONS = ['Today’s challenge', 'Import', 'Habits', 'Journal', 'Goals', 'Focus', 'History'];

const failures: string[] = [];

function check(ok: boolean, what: string, detail = ''): void {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(what);
}

async function textShell(browser: Browser): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE_URL}/text`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first load installs the worker; the second is the one it controls.
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the service worker controls /text');

  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.getByRole('heading', { name: 'Goals' }).waitFor({ timeout: 10000 });
  const headings = await page.locator('h2').allInnerTexts();
  check(
    SECTIONS.every((s) => headings.includes(s)),
    '/text offline: every section is there',
    headings.join(' · '),
  );
  // The default state is shown, not held invisible: the first load settled.
  check(await page.getByText('No habits yet').isVisible(), '/text offline: the page settles, not stuck pending');

  await page.goto(`${BASE_URL}/`, { waitUntil: 'load' });
  check(new URL(page.url()).pathname === '/text', '/ offline, cold: the /text shell answers', page.url());

  check(errors.length === 0, '/text offline: no page errors', errors.slice(0, 2).join(' | '));
  await context.close();
}

async function openRoom(browser: Browser): Promise<void> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-room-ready]', { timeout: 60000 });
  await context.setOffline(true);
  await page.waitForTimeout(1000);

  await page.getByRole('button', { name: 'bonsai', exact: true }).focus();
  await page.keyboard.press('Enter');
  const opened = await page
    .locator('aside[role="region"]')
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check(opened, 'an open room, gone offline: a panel still opens');
  check((await page.locator('canvas').count()) === 1, 'an open room, gone offline: the canvas stays');
  check(errors.length === 0, 'an open room, gone offline: no page errors', errors.slice(0, 2).join(' | '));
  await context.close();
}

async function main(): Promise<void> {
  console.log(`offline:check  (${BASE_URL})`);
  // Full Chromium on SwiftShader, as capture-states.ts: the room needs WebGL.
  const browser = await chromium.launch({
    channel: 'chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    await textShell(browser);
    await openRoom(browser);
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error(`\noffline:check: ${failures.length} failure(s).`);
    process.exit(1);
  }
  console.log('\noffline:check: /text works on a train.');
}

main().catch((err) => {
  console.error(`\noffline:check failed: ${(err as Error).message}\n`);
  console.error('Is the production server running? `pnpm build && pnpm start`.');
  process.exit(1);
});
