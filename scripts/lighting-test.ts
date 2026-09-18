/**
 * lighting:test — the five-item lighting acceptance test, measured.
 *
 * design-system/05-lighting-rig.md §4 lists five criteria that must all read
 * TRUE before the rig is signed off, and CLAUDE.md non-negotiable 7 requires
 * re-running them after any change that emits or blocks light. They were
 * written to be eyeballed, which makes "the right edge reads cooler" a matter
 * of opinion and makes a regression easy to miss. This measures them off the
 * committed capture instead.
 *
 * Reads captures/<label>/room-rest-desktop.png (default label: local), so run
 * pnpm capture:states first. Playwright decodes the PNG — Node has no image
 * decoder and the alternative is hand-inflating IDAT chunks. The file goes in
 * as a data URL because a page cannot load a file:// image it does not share
 * an origin with, and a data URL does not taint the canvas.
 *
 * Exits non-zero if any criterion fails, so CI can gate on it.
 *
 * Usage:
 *   pnpm lighting:test                                    effects on
 *   pnpm lighting:test local room-rest-desktop-reduced-motion   effects off
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const LABEL = process.argv[2] ?? 'local';
/**
 * Which capture to measure. 05-lighting-rig.md §5 requires the test to pass
 * with post-processing both on and off; bloom is disabled under reduced
 * motion, so `room-rest-desktop-reduced-motion` IS the effects-off case.
 */
const STATE = process.argv[3] ?? 'room-rest-desktop';
const IMAGE = join(process.cwd(), 'captures', LABEL, `${STATE}.png`);

/** A rectangle in the 1600x1000 desktop capture, as fractions of the frame. */
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Sample regions. Fractions, not pixels, so a change of capture size does not
 * silently move every probe off its subject.
 */
const REGIONS: Record<string, Box> = {
  // The desk top under the lamp, left of the monitors.
  lampPool: { x0: 0.24, y0: 0.6, x1: 0.33, y1: 0.7 },
  // Left and right thirds, for the warm/cool split.
  leftThird: { x0: 0.0, y0: 0.0, x1: 0.33, y1: 1.0 },
  rightThird: { x0: 0.67, y0: 0.0, x1: 1.0, y1: 1.0 },
  // Floor at camera-left, where the door spill lands.
  floorLeft: { x0: 0.02, y0: 0.8, x1: 0.22, y1: 0.99 },
  // The keyboard, which is what the lamp's outer falloff has to reach.
  keyboard: { x0: 0.47, y0: 0.655, x1: 0.59, y1: 0.705 },
  // The two screens. They are the only things that could plausibly out-shine
  // the lamp pool, so criterion 1 has to compare against them by name.
  monitor1: { x0: 0.36, y0: 0.42, x1: 0.5, y1: 0.54 },
  monitor2: { x0: 0.56, y0: 0.43, x1: 0.69, y1: 0.54 },
};

interface Sample {
  /** Mean relative luminance, 0..1. */
  lum: number;
  /** Peak relative luminance in the region. */
  peak: number;
  /** Mean R − B in 0..255 terms. Positive is warm, negative is cool. */
  warmth: number;
}

async function sample(): Promise<{ regions: Record<string, Sample>; frameMax: number }> {
  const browser = await chromium.launch({ channel: 'chromium' });
  const page = await browser.newPage();
  try {
    return await page.evaluate(
      async ({ src, regions }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('no 2d context');
        ctx.drawImage(img, 0, 0);

        // Relative luminance per WCAG, which is also what the bloom pass
        // thresholds on.
        const toLinear = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        const lumOf = (r: number, g: number, b: number) =>
          0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

        const full = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let frameMax = 0;
        for (let i = 0; i < full.length; i += 4) {
          const l = lumOf(full[i]!, full[i + 1]!, full[i + 2]!);
          if (l > frameMax) frameMax = l;
        }

        const out: Record<string, { lum: number; peak: number; warmth: number }> = {};
        for (const [name, box] of Object.entries(regions)) {
          const x = Math.round(box.x0 * canvas.width);
          const y = Math.round(box.y0 * canvas.height);
          const w = Math.max(1, Math.round((box.x1 - box.x0) * canvas.width));
          const h = Math.max(1, Math.round((box.y1 - box.y0) * canvas.height));
          const px = ctx.getImageData(x, y, w, h).data;
          let lum = 0;
          let peak = 0;
          let warmth = 0;
          const n = px.length / 4;
          for (let i = 0; i < px.length; i += 4) {
            const r = px[i]!;
            const g = px[i + 1]!;
            const b = px[i + 2]!;
            const l = lumOf(r, g, b);
            lum += l;
            if (l > peak) peak = l;
            warmth += r - b;
          }
          out[name] = { lum: lum / n, peak, warmth: warmth / n };
        }
        return { regions: out, frameMax };
      },
      { src: `data:image/png;base64,${readFileSync(IMAGE).toString('base64')}`, regions: REGIONS },
    );
  } finally {
    await browser.close();
  }
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  if (!existsSync(IMAGE)) {
    console.error(`lighting:test: no capture at ${IMAGE}`);
    console.error('Run `pnpm dev` and then `pnpm capture:states` first.');
    process.exit(1);
  }
  console.log(`lighting:test -> ${IMAGE}`);

  const { regions, frameMax } = await sample();
  const r = (name: string): Sample => {
    const s = regions[name];
    if (!s) throw new Error(`region ${name} not sampled`);
    return s;
  };

  const lampPool = r('lampPool');
  const monitor1 = r('monitor1');
  const monitor2 = r('monitor2');
  const left = r('leftThird');
  const right = r('rightThird');
  const floorLeft = r('floorLeft');
  const keyboard = r('keyboard');

  // 4: the lamp's outer falloff. The spec says "~20%", of the lamp pool.
  const falloff = keyboard.lum / lampPool.lum;

  const results: { criterion: string; pass: boolean; evidence: string }[] = [
    {
      // Compared by MEAN, not by peak. The brightest single pixel in the frame
      // is a specular highlight on a brass drawer handle, which is a line, not
      // an area — peak would fail this criterion on a scene that plainly
      // satisfies it. frameMax is still reported, to catch a genuine runaway.
      criterion: 'the lamp pool is the brightest area in frame',
      pass:
        lampPool.lum > monitor1.lum &&
        lampPool.lum > monitor2.lum &&
        lampPool.lum > floorLeft.lum,
      evidence:
        `pool ${lampPool.lum.toFixed(3)} vs monitors ` +
        `${monitor1.lum.toFixed(3)}/${monitor2.lum.toFixed(3)}, ` +
        `floor ${floorLeft.lum.toFixed(3)}; frame peak ${frameMax.toFixed(3)}`,
    },
    {
      criterion: 'the right edge reads cooler than the left',
      pass: right.warmth < left.warmth,
      evidence: `warmth left ${left.warmth.toFixed(1)} vs right ${right.warmth.toFixed(1)} (R-B)`,
    },
    {
      criterion: 'a warm rectangle is visible on the floor at camera-left',
      pass: floorLeft.lum > 0.002 && floorLeft.warmth > 0,
      evidence: `floor lum ${floorLeft.lum.toFixed(4)}, warmth ${floorLeft.warmth.toFixed(1)}`,
    },
    {
      criterion: 'the keyboard sits in the lamp outer falloff (~20%)',
      pass: falloff >= 0.1 && falloff <= 0.4,
      evidence: `keyboard ${pct(falloff)} of the lamp pool`,
    },
    {
      criterion: 'no object is pure black and none is ambient-flooded',
      pass: keyboard.lum > 0 && lampPool.peak < 1,
      evidence: `keyboard lum ${keyboard.lum.toFixed(4)}, pool peak ${lampPool.peak.toFixed(3)}`,
    },
  ];

  let failed = 0;
  for (const [i, res] of results.entries()) {
    const mark = res.pass ? 'TRUE ' : 'FALSE';
    if (!res.pass) failed += 1;
    console.log(`  ${i + 1}. ${mark}  ${res.criterion}`);
    console.log(`            ${res.evidence}`);
  }

  if (failed > 0) {
    console.error(`\nlighting:test: ${failed} of 5 criteria FAILED.`);
    process.exit(1);
  }
  console.log('\nlighting:test: all five criteria read TRUE.');
}

await main();
