// Monitor 1's screen — today's challenge as a canvas texture (build plan 3.1).
//
// spec/02 F1 "Room behaviour": a CANVAS texture driven from the store, not a
// drei <Html> element — an HTML element pretending to be a screen breaks the
// moment the camera tilts. Title in Fraunces italic, prompt in Departure Mono,
// faint source at the bottom. Dark ink on the glow: see canvasScreen.ts.

import { useCallback } from 'react';
import type { CanvasTexture } from 'three';

import { useAppStore, type Challenge } from '../../lib/stores/app';
import { BG_NIGHT } from '../../lib/style/colors';
import { SCREEN_H, SCREEN_PAD as PAD, SCREEN_W, paintBackground, useCanvasScreen, wrap, type ScreenFaces } from './canvasScreen';

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

function draw(ctx: CanvasRenderingContext2D, copy: ScreenCopy, faces: ScreenFaces): void {
  paintBackground(ctx);
  ctx.fillStyle = BG_NIGHT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  ctx.globalAlpha = 0.85;
  ctx.font = `italic 400 ${TITLE_PX}px ${faces.display}`;
  ctx.fillText(copy.title, PAD, PAD + TITLE_PX);

  if (copy.done) {
    ctx.font = `400 ${FOOT_PX}px ${faces.mono}`;
    ctx.textAlign = 'right';
    ctx.fillText('done today', SCREEN_W - PAD, PAD + TITLE_PX);
    ctx.textAlign = 'left';
  }

  ctx.globalAlpha = 1;
  ctx.font = `400 ${BODY_PX}px ${faces.mono}`;
  wrap(ctx, copy.body, SCREEN_W - PAD * 2, BODY_MAX_LINES).forEach((text, i) => {
    ctx.fillText(text, PAD, PAD + TITLE_PX + 70 + i * BODY_LINE);
  });

  if (copy.foot) {
    ctx.globalAlpha = 0.55;
    ctx.font = `400 ${FOOT_PX}px ${faces.mono}`;
    ctx.fillText(copy.foot, PAD, SCREEN_H - PAD + FOOT_PX / 2, SCREEN_W - PAD * 2);
  }
}

/** The screen texture, redrawn whenever today's challenge changes. */
export function useChallengeScreen(): CanvasTexture {
  const challenge = useAppStore((s) => s.challenge);
  const hydrated = useAppStore((s) => s.hydrated);
  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, faces: ScreenFaces) => draw(ctx, copyFor(challenge, hydrated), faces),
    [challenge, hydrated],
  );
  return useCanvasScreen(paint);
}
