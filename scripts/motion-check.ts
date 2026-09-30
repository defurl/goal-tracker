/**
 * motion:check — the reduced-motion pass, asserted (build plan 4.3,
 * design-system/03-motion.md §"Reduced motion, concretely").
 *
 * Under prefers-reduced-motion ambient motion is REMOVED, not slowed. The
 * strongest test of that is that nothing moves at all: two frames of the room a
 * second apart must be pixel-identical. That one comparison covers most of the
 * table at once — dust motes frozen, rain not rendered, bloom off, grain at
 * opacity 0, every state lerp snapped. The same holds straight after opening a
 * panel, which covers the camera glide (done on frame 1) and the detail panel
 * (no fade, no wait).
 *
 * The rows a still frame cannot prove are read from the DOM: the grain's
 * opacity and animation, the panel's animation, and the global transition
 * escape hatch.
 *
 * The room at rest is checked twice: at the runner's hour, and pinned to dawn,
 * the one band with steam on the mug (A5.3). Stillness cannot tell removed from
 * frozen; MugSteam returns null under reduced motion, and this proves nothing moves.
 *
 * And the control: with motion allowed, the same two frames must DIFFER. A
 * stillness test that would also pass on a room that moves is proving nothing.
 *
 * Needs the production server: `pnpm build && pnpm start`, then
 * `pnpm motion:check`. CAPTURE_BASE_URL overrides http://localhost:3000.
 */

import { chromium, type Browser, type Page } from 'playwright';

import { zoneForHour } from './zone-for-hour.ts';

const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000';
const VIEWPORT = { width: 1280, height: 800 };
const APART_MS = 1000;

const failures: string[] = [];

function check(ok: boolean, what: string, detail = ''): void {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(what);
}

async function openRoom(browser: Browser, reduced: boolean, hour?: number, scene: 'room' | 'hall' = 'room'): Promise<Page> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    colorScheme: 'dark',
    ...(hour === undefined ? {} : { timezoneId: zoneForHour(hour) }),
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/${scene === 'hall' ? '?scene=hall' : ''}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(`[data-room-ready][data-scene="${scene}"]`, { timeout: 90000 });
  // A few settled frames, so a first-frame texture upload is not mistaken for
  // motion.
  await page.waitForTimeout(1500);
  return page;
}

async function stillOverOneSecond(page: Page): Promise<boolean> {
  const a = await page.screenshot();
  await page.waitForTimeout(APART_MS);
  const b = await page.screenshot();
  return a.equals(b);
}

async function reducedMotion(browser: Browser): Promise<void> {
  console.log('\nreduced motion');
  const page = await openRoom(browser, true);

  check(await stillOverOneSecond(page), 'the room at rest does not move');

  const grain = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector('.grain') as Element);
    return { opacity: s.opacity, animation: s.animationName };
  });
  check(
    grain.opacity === '0' && grain.animation === 'none',
    'film grain is at opacity 0 and not animating',
    JSON.stringify(grain),
  );

  const transition = await page.evaluate(() => {
    const button = document.querySelector('main button');
    return button ? getComputedStyle(button).transitionDuration : null;
  });
  check(
    transition !== null && transition.split(',').every((d) => parseFloat(d) <= 0.00001),
    'CSS transitions collapse to 0.001 ms',
    String(transition),
  );

  // Open a panel the keyboard way and look at once: the glide must already be
  // over and the panel already there.
  await page.getByRole('button', { name: 'journal', exact: true }).focus();
  await page.keyboard.press('Enter');
  const panel = page.locator('aside[role="region"]');
  await panel.waitFor();
  await page.waitForTimeout(200);
  check(await stillOverOneSecond(page), 'opening a panel: no glide, no fade, still from the first frames');

  const animation = await panel.evaluate((el) => getComputedStyle(el).animationName);
  check(animation === 'none', 'the detail panel has no animation', animation);

  await page.context().close();

  const dawn = await openRoom(browser, true, 6);
  check(await stillOverOneSecond(dawn), 'the room at dawn, the steam band, does not move');
  await dawn.context().close();

  // The hall behind the door (design-system/13): nothing there moves either.
  const hall = await openRoom(browser, true, undefined, 'hall');
  check(await stillOverOneSecond(hall), 'the hall at rest does not move');
  await hall.context().close();
}

async function control(browser: Browser): Promise<void> {
  console.log('\ncontrol: motion allowed');
  const page = await openRoom(browser, false);
  check(!(await stillOverOneSecond(page)), 'the room at rest DOES move when motion is allowed');
  await page.context().close();
}

async function main(): Promise<void> {
  console.log(`motion:check  (${BASE_URL})`);
  // Full Chromium on SwiftShader, as capture-states.ts: the room needs WebGL.
  const browser = await chromium.launch({
    channel: 'chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    await reducedMotion(browser);
    await control(browser);
  } finally {
    await browser.close();
  }

  if (failures.length > 0) {
    console.error(`\nmotion:check: ${failures.length} failure(s).`);
    process.exit(1);
  }
  console.log('\nmotion:check: motion is removed, not reduced.');
}

main().catch((err) => {
  console.error(`\nmotion:check failed: ${(err as Error).message}\n`);
  console.error('Is the production server running? `pnpm build && pnpm start`.');
  process.exit(1);
});
