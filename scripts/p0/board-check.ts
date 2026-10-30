/**
 * board check — Phase 7 P0's board test gate (spec/06 Phase 7): the board shell
 * and its first card at /text/board, checked for contrast and keyboard use.
 *
 * At a desktop and a phone viewport:
 *   - axe-core over the page;
 *   - Tab through the page: every stop is listed with whether a focus ring is
 *     visible (an outline of at least 2 px);
 *   - the card's real background: the card is screenshotted with its text
 *     hidden, and its darkest and lightest pixels over the blurred room are
 *     what every text token is measured against (D-22 §3: 4.5 : 1 for text,
 *     3 : 1 for the focus ring and input borders).
 *
 * Needs the app running: `pnpm dev` (or a production server), then
 * `node scripts/p0/board-check.ts`. BOARD_BASE_URL overrides
 * http://localhost:3000. Writes captures/p0/board-check.json and two PNGs.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium, type Page } from 'playwright';

import {
  V2_INK,
  V2_INK_FAINT,
  V2_INK_MUTED,
  V2_INTERACTIVE,
  V2_INTERACTIVE_INK,
} from '../../lib/style/colors.ts';

const BASE = process.env.BOARD_BASE_URL ?? 'http://localhost:3000';
const OUT = join(process.cwd(), 'captures/p0');

type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/**
 * The darkest and lightest pixels of a PNG, decoded in the page's canvas.
 * `inset` skips a card's border and rounded corners; text boxes use 0.
 */
async function extremes(page: Page, png: Buffer, inset: number): Promise<{ darkest: RGB; lightest: RGB }> {
  return page.evaluate(async ({ b64, inset }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(inset, inset, img.width - 2 * inset, img.height - 2 * inset).data;
    let lo: [number, number, number] = [255, 255, 255];
    let hi: [number, number, number] = [0, 0, 0];
    const y = (p: number[]) => 0.2126 * (p[0] ?? 0) + 0.7152 * (p[1] ?? 0) + 0.0722 * (p[2] ?? 0);
    for (let i = 0; i < data.length; i += 4) {
      const p: [number, number, number] = [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
      if (y(p) < y(lo)) lo = p;
      if (y(p) > y(hi)) hi = p;
    }
    return { darkest: lo, lightest: hi };
  }, { b64: png.toString('base64'), inset });
}

async function view(name: string, width: number, height: number) {
  const browser = await chromium.launch();
  // axe needs a page from an explicit context, not browser.newPage().
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  await page.goto(`${BASE}/text/board`, { waitUntil: 'networkidle' });
  await page.waitForSelector('section[aria-labelledby="challenge-title"] p, section[aria-labelledby="challenge-title"] button');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, `board-${name}.png`) });

  const axe = await new AxeBuilder({ page }).analyze();

  // `inBoard`: the old night-room account control also sits on this page; the
  // v2 ring rule judges only the board's own controls.
  const tabStops: { text: string; ring: boolean; inBoard: boolean }[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const ring = s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) >= 2;
      const inBoard = Boolean(el.closest('main, header'));
      return { text: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40), ring, inBoard };
    });
    if (!stop) break;
    if (tabStops.some((t) => t.text === stop.text)) break;
    tabStops.push(stop);
  }

  // Hide the board's words so screenshots show only what sits behind them.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('header *, main *')) el.style.color = 'transparent';
    for (const el of document.querySelectorAll<HTMLElement>('main button, main span')) el.style.visibility = 'hidden';
  });
  const bg = await extremes(page, await page.locator('section[aria-labelledby="challenge-title"]').screenshot(), 14);
  // Text set straight on the blurred room, with no card behind it.
  const onRoom: Record<string, number> = {};
  for (const [label, selector] of [
    ['room link', 'header a[href="/"]'],
    ['greeting', 'main h1'],
    ['date', 'main h1 + p'],
  ] as const) {
    const under = await extremes(page, await page.locator(selector).screenshot(), 0);
    onRoom[label] = contrast(rgb(V2_INK), under.darkest);
  }
  await browser.close();

  const worst = bg.darkest;
  return {
    viewport: `${width}x${height}`,
    axe: axe.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.map((n) => n.target.join(' ')) })),
    tabStops,
    onRoom,
    card: bg,
    contrast: {
      ink: contrast(rgb(V2_INK), worst),
      inkMuted: contrast(rgb(V2_INK_MUTED), worst),
      interactiveInk: contrast(rgb(V2_INTERACTIVE_INK), worst),
      focusRing: contrast(rgb(V2_INTERACTIVE), worst),
      inputBorder: contrast(rgb(V2_INK_FAINT), worst),
    },
  };
}

mkdirSync(OUT, { recursive: true });
const report = { desktop: await view('desktop', 1440, 900), phone: await view('phone', 390, 844) };
writeFileSync(join(OUT, 'board-check.json'), `${JSON.stringify(report, null, 2)}\n`);

let failed = 0;
for (const [name, r] of Object.entries(report)) {
  const text = [r.contrast.ink, r.contrast.inkMuted, r.contrast.interactiveInk].every((c) => c >= 4.5);
  // The greeting is large text (36 px; 28 px on phones), so 3 : 1 (WCAG 1.4.3).
  const room = Object.entries(r.onRoom).every(([label, c]) => c >= (label === 'greeting' ? 3 : 4.5));
  const nonText = r.contrast.focusRing >= 3 && r.contrast.inputBorder >= 3;
  const boardStops = r.tabStops.filter((t) => t.inBoard);
  const rings = boardStops.length > 0 && boardStops.every((t) => t.ring);
  console.log(`\n${name} ${r.viewport}`);
  console.log(`  axe: ${r.axe.length ? r.axe.map((v) => `${v.id} (${v.impact}): ${v.nodes.join(', ')}`).join('; ') : 'no violations'}`);
  console.log(`  tab: ${r.tabStops.map((t) => `${t.text}${t.inBoard ? (t.ring ? '' : ' [NO RING]') : ' (outside the board)'}`).join(' → ')}`);
  console.log(`  card background, darkest / lightest: rgb(${r.card.darkest.join(',')}) / rgb(${r.card.lightest.join(',')})`);
  console.log(`  contrast on the card's darkest: ${JSON.stringify(r.contrast)}`);
  console.log(`  ink straight on the room: ${JSON.stringify(r.onRoom)}`);
  console.log(
    `  card text ≥ 4.5: ${text ? 'yes' : 'NO'} · text on the room (4.5, greeting 3): ${room ? 'yes' : 'NO'} · ring and borders ≥ 3: ${nonText ? 'yes' : 'NO'} · board stops have a ring: ${rings ? 'yes' : 'NO'}`,
  );
  if (!text || !room || !nonText || !rings) failed += 1;
}
console.log(`\nboard check: ${failed === 0 ? 'passes' : `${failed} view(s) failing`}; axe findings listed above — captures/p0/board-check.json`);
process.exit(failed === 0 ? 0 : 1);
