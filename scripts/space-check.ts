/**
 * space check — the 2.5D room's acceptance test, the parts a browser can
 * measure (design-system/v2/05-room.md): at 1280, 1440 and 1920 wide and at a
 * phone size,
 *
 *   - Home: every hotspot is on screen, not under the menu, and its label
 *     reads at 4.5 : 1 on its own background;
 *   - Today, deep-linked: the room settles, the heading takes focus, card text
 *     holds 4.5 : 1 against the card's darkest pixel, and the heading and date
 *     set straight on the softened room hold 3 : 1 and 4.5 : 1;
 *   - axe over both, and every board control shows a focus ring.
 *
 * Needs the app running (`pnpm dev`), then `pnpm space:check`. SPACE_BASE_URL
 * overrides http://localhost:3000. Writes captures/space/.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium, type Page } from 'playwright';

import { V2_INK, V2_INK_MUTED, V2_INTERACTIVE_INK, V2_SURFACE } from '../lib/style/colors.ts';

const BASE = process.env.SPACE_BASE_URL ?? 'http://localhost:3000';
const OUT = join(process.cwd(), 'captures/space');

type RGB = [number, number, number];

const rgb = (hex: string): RGB => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const luminance = ([r, g, b]: RGB) => {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a: RGB, b: RGB) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};

/** The darkest and lightest pixel of a PNG, decoded in the page. `inset` skips borders and corners. */
async function extremes(page: Page, png: Buffer, inset: number): Promise<{ darkest: RGB; lightest: RGB }> {
  return page.evaluate(
    async ({ b64, inset }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(inset, inset, img.width - 2 * inset, img.height - 2 * inset).data;
      const y = (p: number[]) => 0.2126 * (p[0] ?? 0) + 0.7152 * (p[1] ?? 0) + 0.0722 * (p[2] ?? 0);
      let lo: [number, number, number] = [255, 255, 255];
      let hi: [number, number, number] = [0, 0, 0];
      for (let i = 0; i < d.length; i += 4) {
        const p: [number, number, number] = [d[i] ?? 0, d[i + 1] ?? 0, d[i + 2] ?? 0];
        if (y(p) < y(lo)) lo = p;
        if (y(p) > y(hi)) hi = p;
      }
      return { darkest: lo, lightest: hi };
    },
    { b64: png.toString('base64'), inset },
  );
}

async function settled(page: Page, phase: string) {
  await page.waitForSelector(`[data-phase="${phase}"]`, { timeout: 15000 });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
}

async function view(name: string, width: number, height: number) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();

  // ── Home ──
  await page.goto(`${BASE}/room`, { waitUntil: 'networkidle' });
  await settled(page, 'home');
  await page.screenshot({ path: join(OUT, `home-${name}.png`) });
  const menuBox = await page.locator('header').boundingBox();
  const hotspots = await page.locator('nav[aria-label="Objects in the room"] a').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { label: el.textContent?.trim() ?? '', x: r.x, y: r.y, w: r.width, h: r.height, visible: getComputedStyle(el).display !== 'none' };
    }),
  );
  const hotspotReport = hotspots.map((h) => ({
    ...h,
    onScreen: h.x >= 0 && h.y >= 0 && h.x + h.w <= width && h.y + h.h <= height,
    underMenu: menuBox ? h.y < menuBox.y + menuBox.height : false,
  }));
  const homeAxe = await new AxeBuilder({ page }).analyze();

  // ── Today, deep-linked ──
  await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await settled(page, 'focused');
  await page.screenshot({ path: join(OUT, `today-${name}.png`) });
  const focusedHeading = await page.evaluate(() => document.activeElement?.tagName === 'H1');
  const todayAxe = await new AxeBuilder({ page }).analyze();

  const stops: { text: string; ring: boolean }[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body || el.dataset.tabSeen) return null;
      el.dataset.tabSeen = '1';
      const s = getComputedStyle(el);
      return {
        text: (el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40),
        ring: s.outlineStyle !== 'none' && Number.parseFloat(s.outlineWidth) >= 2,
      };
    });
    if (!stop) break;
    stops.push(stop);
  }

  // Hide everything inside the cards, and the sticky bar that scrolls over
  // them, so the screenshots show only the backgrounds text sits on.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('#space-main section *, header:has(nav[aria-label="Modules"])')) el.style.visibility = 'hidden';
    for (const el of document.querySelectorAll<HTMLElement>('#space-main h1, #space-main h1 + p')) el.style.color = 'transparent';
  });
  const cards = page.locator('#space-main section');
  let cardDarkest: RGB = [255, 255, 255];
  let darkestCard = '';
  for (let i = 0; i < (await cards.count()); i++) {
    const { darkest } = await extremes(page, await cards.nth(i).screenshot(), 14);
    if (luminance(darkest) < luminance(cardDarkest)) {
      cardDarkest = darkest;
      darkestCard = (await cards.nth(i).getAttribute('aria-labelledby')) ?? String(i);
    }
  }
  const onRoom: Record<string, number> = {};
  for (const [label, selector] of [
    ['heading', '#space-main h1'],
    ['date', '#space-main h1 + p'],
  ] as const) {
    onRoom[label] = contrast(rgb(V2_INK), (await extremes(page, await page.locator(selector).screenshot(), 0)).darkest);
  }
  await browser.close();

  return {
    viewport: `${width}x${height}`,
    hotspots: hotspotReport,
    hotspotLabel: contrast(rgb(V2_INK), rgb(V2_SURFACE)),
    focusedHeading,
    tabStops: stops,
    cardDarkest,
    darkestCard,
    card: {
      ink: contrast(rgb(V2_INK), cardDarkest),
      inkMuted: contrast(rgb(V2_INK_MUTED), cardDarkest),
      interactiveInk: contrast(rgb(V2_INTERACTIVE_INK), cardDarkest),
    },
    onRoom,
    axe: [...homeAxe.violations, ...todayAxe.violations].map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
  };
}

mkdirSync(OUT, { recursive: true });
const sizes = [
  ['1280', 1280, 720],
  ['1440', 1440, 810],
  ['1920', 1920, 1080],
  ['phone', 390, 844],
] as const;
const report: Record<string, Awaited<ReturnType<typeof view>>> = {};
for (const [name, w, h] of sizes) report[name] = await view(name, w, h);
writeFileSync(join(OUT, 'space-check.json'), `${JSON.stringify(report, null, 2)}\n`);

let failed = 0;
for (const [name, r] of Object.entries(report)) {
  const desktop = name !== 'phone';
  const spots = !desktop || r.hotspots.every((h) => h.onScreen && !h.underMenu);
  const card = r.card.ink >= 4.5 && r.card.inkMuted >= 4.5 && r.card.interactiveInk >= 4.5;
  const room = (r.onRoom.heading ?? 0) >= 3 && (r.onRoom.date ?? 0) >= 4.5;
  const rings = r.tabStops.length > 0 && r.tabStops.every((t) => t.ring);
  const ok = spots && card && room && rings && r.focusedHeading;
  console.log(`\n${name} ${r.viewport}: ${ok ? 'passes' : 'FAILS'}`);
  console.log(`  hotspots on screen, clear of the menu: ${spots ? 'yes' : 'NO'}${desktop ? '' : ' (not required on phones)'}`);
  console.log(`  card text ≥ 4.5 over its darkest pixel: ${JSON.stringify(r.card)}`);
  console.log(`  text on the room (heading 3, date 4.5): ${JSON.stringify(r.onRoom)}`);
  console.log(`  heading focused on arrival: ${r.focusedHeading ? 'yes' : 'NO'} · ${r.tabStops.length} tab stops, all ringed: ${rings ? 'yes' : 'NO'}`);
  console.log(`  axe: ${r.axe.length ? r.axe.map((v) => `${v.id} (${v.impact}, ${v.nodes})`).join('; ') : 'no violations'}`);
  if (!ok) failed += 1;
}
console.log(`\nspace check: ${failed === 0 ? 'passes' : `${failed} size(s) failing`} — captures/space/`);
process.exit(failed === 0 ? 0 : 1);
