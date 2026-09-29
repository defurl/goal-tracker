/**
 * a11y:check — axe-core over every rendered route (build plan 4.2,
 * design-system/10-tech-stack.md §2).
 *
 * WCAG 2.1 A and AA rules. Any violation fails the run, with its rule, impact
 * and the first few offending nodes printed.
 *
 * The room is checked twice over: at rest, and with each object's panel open,
 * because its accessible surface is mostly not visible at rest — the hidden
 * 48x48 buttons InteractiveObject puts at each label, the panel they open, and
 * the corner controls. Each panel is opened the way a keyboard user opens it:
 * focus the object's button, press Enter; Escape returns to the desk. Reduced
 * motion so the panel is there at once rather than after its 1200 ms wait.
 *
 * Needs the production server: `pnpm build && pnpm start`, then
 * `pnpm a11y:check`. CAPTURE_BASE_URL overrides http://localhost:3000.
 */

import AxeBuilder from '@axe-core/playwright';
import { chromium, type Browser, type Page } from 'playwright';

const BASE_URL = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const DESKTOP = { width: 1600, height: 1000 };
const MOBILE = { width: 390, height: 844 };

/** The label of every object that opens a panel, as RoomScene names them. */
const ROOM_PANELS = ['daily challenge', 'goals', 'bonsai', 'journal', 'article import', 'tracker'];

let violations = 0;

async function scan(page: Page, name: string): Promise<void> {
  // The canvas is pixels, not content: its accessible surface is the DOM
  // around it, which is what gets scanned.
  const result = await new AxeBuilder({ page }).withTags(TAGS).exclude('canvas').analyze();
  if (result.violations.length === 0) {
    console.log(`  ok    ${name}  (${result.passes.length} rules pass)`);
    return;
  }
  violations += result.violations.length;
  console.error(`  FAIL  ${name}`);
  for (const v of result.violations) {
    console.error(`        ${v.id} [${v.impact}] ${v.help}`);
    for (const node of v.nodes.slice(0, 3)) {
      console.error(`          ${node.target.join(' ')}  ${node.failureSummary?.split('\n')[1]?.trim() ?? ''}`);
    }
  }
}

async function open(browser: Browser, route: string, viewport: typeof DESKTOP): Promise<Page> {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  return page;
}

async function checkRoom(browser: Browser): Promise<void> {
  const page = await open(browser, '/', DESKTOP);
  await page.waitForSelector('[data-room-ready]', { timeout: 60000 });
  await scan(page, '/ at rest');

  for (const label of ROOM_PANELS) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'back to the desk' }).waitFor();
    await scan(page, `/ with the ${label} panel open`);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'back to the desk' }).waitFor({ state: 'detached' });
  }
  await page.context().close();
}

async function checkPage(browser: Browser, route: string, viewport: typeof DESKTOP, name: string): Promise<void> {
  const page = await open(browser, route, viewport);
  await scan(page, name);
  await page.context().close();
}

async function main(): Promise<void> {
  console.log(`a11y:check  (${BASE_URL})`);
  // Full Chromium, not the headless shell, and SwiftShader: the room needs
  // WebGL to become ready (see capture-states.ts).
  const browser = await chromium.launch({
    channel: 'chromium',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    await checkRoom(browser);
    for (const route of ['/text', '/login', '/signup']) {
      await checkPage(browser, route, DESKTOP, `${route} desktop`);
      await checkPage(browser, route, MOBILE, `${route} mobile`);
    }
  } finally {
    await browser.close();
  }

  if (violations > 0) {
    console.error(`\na11y:check: ${violations} violation(s).`);
    process.exit(1);
  }
  console.log('\na11y:check: no violations.');
}

main().catch((err) => {
  console.error(`\na11y:check failed: ${(err as Error).message}\n`);
  console.error('Is the production server running? `pnpm build && pnpm start`.');
  process.exit(1);
});
