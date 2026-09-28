// Monitor 1's screen — today's challenge as a canvas texture (build plan 3.1).
//
// spec/02 F1 "Room behaviour": a CANVAS texture driven from the store, not a
// drei <Html> element — an HTML element pretending to be a screen breaks the
// moment the camera tilts. Title in Fraunces italic, prompt in Departure Mono,
// faint source at the bottom.
//
// The canvas is the screen's EMISSIVE MAP, and the emissive colour is
// multiplied by it. So the background keeps the gradient the plain monitor
// had (paper at the top fading to faint), and the text is drawn in dark ink.
// Bright text on a dark screen was the other option; it would drop most of the
// screen below the 0.1 bloom threshold and leave only the letters glowing,
// which is the flat-monitor regression D-20 exists to prevent.
//
// Redraws on change only (spec/05 §3: "redraw on change — discrete"). The
// subscription is to rare, discrete values, never to anything per-tick.

import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

import { useAppStore, type Challenge } from '../../lib/stores/app';
import { BG_NIGHT, INK_FAINT, INK_MUTED, INK_PAPER } from '../../lib/style/colors';

/** Matches the screen plane's aspect (0.596 x 0.336 m), so text is not stretched. */
const WIDTH = 1024;
const HEIGHT = 577;
const PAD = 64;

const TITLE_PX = 46;
const BODY_PX = 30;
const BODY_LINE = 42;
const BODY_MAX_LINES = 6;
const FOOT_PX = 20;

interface ScreenCopy {
  title: string;
  body: string;
  foot: string | null;
  done: boolean;
}

function copyFor(challenge: Challenge | null, hydrated: boolean): ScreenCopy {
  // Before the first load the screen shows only its title, so a signed-in user
  // never sees the empty state flash up in front of their real challenge.
  if (!hydrated) return { title: 'today’s challenge', body: '', foot: null, done: false };
  // FR-1.7: a welcome that routes to import, never a blank surface.
  if (!challenge) {
    return {
      title: 'nothing saved yet',
      body: 'Pick up the phone and paste an article. It comes back as one thing you can do in two minutes.',
      foot: null,
      done: false,
    };
  }
  return {
    title: 'today’s challenge',
    body: challenge.actionText,
    foot: challenge.sourceUrl ? hostOf(challenge.sourceUrl) : challenge.sourceSummary || null,
    done: challenge.complete,
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function cssFont(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

/** Greedy word wrap, with an ellipsis on the last line if the text runs over. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(next).width <= width) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines) {
    if (line) lines.push(line);
    return lines;
  }
  // Ran over: trim the last line until the ellipsis fits.
  let last = lines[maxLines - 1] ?? '';
  while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  lines[maxLines - 1] = `${last.trimEnd()}…`;
  return lines;
}

interface Fonts {
  title: string;
  body: string;
  foot: string;
}

function fonts(): Fonts {
  const display = cssFont('--font-display', 'Georgia, serif');
  const mono = cssFont('--font-mono', 'ui-monospace, monospace');
  return {
    title: `italic 400 ${TITLE_PX}px ${display}`,
    body: `400 ${BODY_PX}px ${mono}`,
    foot: `400 ${FOOT_PX}px ${mono}`,
  };
}

function draw(ctx: CanvasRenderingContext2D, copy: ScreenCopy, f: Fonts): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, INK_PAPER);
  gradient.addColorStop(0.5, INK_MUTED);
  gradient.addColorStop(1, INK_FAINT);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = BG_NIGHT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.globalAlpha = 0.85;
  ctx.font = f.title;
  ctx.fillText(copy.title, PAD, PAD + TITLE_PX);

  if (copy.done) {
    ctx.font = f.foot;
    ctx.textAlign = 'right';
    ctx.fillText('done today', WIDTH - PAD, PAD + TITLE_PX);
    ctx.textAlign = 'left';
  }

  ctx.globalAlpha = 1;
  ctx.font = f.body;
  wrap(ctx, copy.body, WIDTH - PAD * 2, BODY_MAX_LINES).forEach((text, i) => {
    ctx.fillText(text, PAD, PAD + TITLE_PX + 70 + i * BODY_LINE);
  });

  if (copy.foot) {
    ctx.globalAlpha = 0.55;
    ctx.font = f.foot;
    ctx.fillText(copy.foot, PAD, HEIGHT - PAD + FOOT_PX / 2, WIDTH - PAD * 2);
  }
  ctx.globalAlpha = 1;
}

/** The screen texture, redrawn whenever today's challenge changes. */
export function useChallengeScreen(): CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);

  const challenge = useAppStore((s) => s.challenge);
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    const ctx = (texture.image as HTMLCanvasElement).getContext('2d');
    if (!ctx) return;
    const copy = copyFor(challenge, hydrated);
    const f = fonts();
    let live = true;
    const paint = () => {
      if (!live) return;
      draw(ctx, copy, f);
      texture.needsUpdate = true;
    };
    paint();
    // A canvas cannot trigger a webfont download, and a face nothing in the DOM
    // uses is never fetched — so ask for each one, then paint again with it.
    void Promise.all([f.title, f.body, f.foot].map((font) => document.fonts.load(font)))
      .catch(() => undefined)
      .then(paint);
    return () => {
      live = false;
    };
  }, [texture, challenge, hydrated]);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}
