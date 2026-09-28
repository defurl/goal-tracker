// What every monitor screen texture shares: its size, the gradient it glows
// through, the room's two faces, word wrap, and a texture that repaints on
// change (spec/05 §3: "redraw on change — discrete").
//
// A screen's canvas is its EMISSIVE MAP, so the emissive colour is multiplied
// by it. The background keeps the gradient the plain monitors had (paper at
// the top fading to faint) and content is drawn in dark ink over it. Bright
// text on a dark screen would drop most of the screen below the 0.1 bloom
// threshold — the flat-monitor regression D-20 exists to prevent.

import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

import { INK_FAINT, INK_MUTED, INK_PAPER } from '../../lib/style/colors';

/** Matches the screen plane's aspect (0.596 x 0.336 m), so nothing is stretched. */
export const SCREEN_W = 1024;
export const SCREEN_H = 577;
export const SCREEN_PAD = 64;

export interface ScreenFaces {
  /** Fraunces, from --font-display. */
  display: string;
  /** Departure Mono, from --font-mono. */
  mono: string;
}

function cssFont(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || fallback;
}

export function paintBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_H);
  gradient.addColorStop(0, INK_PAPER);
  gradient.addColorStop(0.5, INK_MUTED);
  gradient.addColorStop(1, INK_FAINT);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
}

/** Fits `text` to `width`, trimming with an ellipsis. */
export function fit(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let out = text;
  while (out && ctx.measureText(`${out}…`).width > width) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

/** Greedy word wrap, with an ellipsis on the last line if the text runs over. */
export function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
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
  lines[maxLines - 1] = fit(ctx, `${lines[maxLines - 1] ?? ''} ${line}`, width);
  return lines;
}

/**
 * A canvas texture that `paint` fills. Repaints whenever `paint` changes, so
 * callers memoise it on exactly the store values the screen shows.
 */
export function useCanvasScreen(paint: (ctx: CanvasRenderingContext2D, faces: ScreenFaces) => void): CanvasTexture {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);

  useEffect(() => {
    const ctx = (texture.image as HTMLCanvasElement).getContext('2d');
    if (!ctx) return;
    const faces = {
      display: cssFont('--font-display', 'Georgia, serif'),
      mono: cssFont('--font-mono', 'ui-monospace, monospace'),
    };
    let live = true;
    const repaint = () => {
      if (!live) return;
      ctx.save();
      paint(ctx, faces);
      ctx.restore();
      texture.needsUpdate = true;
    };
    repaint();
    // A canvas cannot trigger a webfont download, and a face nothing in the DOM
    // uses is never fetched — so ask for each one, then paint again with it.
    void Promise.all([`italic 400 16px ${faces.display}`, `400 16px ${faces.mono}`].map((f) => document.fonts.load(f)))
      .catch(() => undefined)
      .then(repaint);
    return () => {
      live = false;
    };
  }, [texture, paint]);

  useEffect(() => () => texture.dispose(), [texture]);

  return texture;
}
