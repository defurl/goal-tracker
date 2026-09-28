// Monitor 2's screen — the Goal Dashboard as a canvas texture (build plan 3.3).
//
// design-system/12 §3.1: a compact list of goals with progress bars, in the
// cool analytical register. AC-4.5 asks for legibility at the rest pose, where
// the screen is a few hundred pixels wide, so it carries a summary — up to
// four goals, a bar each — and the milestones and the timeline live in the
// panel. An overdue goal draws exactly like any other (FR-4.5, AC-4.4).
//
// Progress is drawn in PAPER over a dark track, so a filled bar is the screen
// glowing through rather than ink laid on it: more done, more light.

import { useCallback } from 'react';
import type { CanvasTexture } from 'three';

import { useAppStore, type GoalSummary } from '../../lib/stores/app';
import { BG_NIGHT, INK_PAPER } from '../../lib/style/colors';
import { SCREEN_H, SCREEN_PAD as PAD, SCREEN_W, fit, paintBackground, useCanvasScreen, wrap, type ScreenFaces } from './canvasScreen';

const TITLE_PX = 46;
const ROW_PX = 26;
const ROW_H = 78;
const BAR_H = 12;
const MAX_ROWS = 4;
const FOOT_PX = 20;
const BODY_PX = 30;

function draw(ctx: CanvasRenderingContext2D, goals: GoalSummary[], hydrated: boolean, faces: ScreenFaces): void {
  paintBackground(ctx);
  ctx.fillStyle = BG_NIGHT;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const inner = SCREEN_W - PAD * 2;

  ctx.globalAlpha = 0.85;
  ctx.font = `italic 400 ${TITLE_PX}px ${faces.display}`;
  const empty = hydrated && goals.length === 0;
  ctx.fillText(empty ? 'no goals yet' : 'goals', PAD, PAD + TITLE_PX);
  ctx.globalAlpha = 1;

  // Before the first load: the title alone, so nobody's goals flash as empty.
  if (!hydrated) return;

  if (empty) {
    ctx.font = `400 ${BODY_PX}px ${faces.mono}`;
    wrap(ctx, 'One thing you want by a date, in a few steps you can tick off.', inner, 3).forEach((line, i) => {
      ctx.fillText(line, PAD, PAD + TITLE_PX + 70 + i * 42);
    });
    return;
  }

  goals.slice(0, MAX_ROWS).forEach((goal, i) => {
    const top = PAD + TITLE_PX + 44 + i * ROW_H;
    ctx.fillStyle = BG_NIGHT;
    ctx.font = `400 ${ROW_PX}px ${faces.mono}`;
    ctx.fillText(fit(ctx, goal.title, inner), PAD, top + ROW_PX);

    const barY = top + ROW_PX + 16;
    ctx.globalAlpha = 0.6;
    ctx.fillRect(PAD, barY, inner, BAR_H);
    ctx.globalAlpha = 1;
    ctx.fillStyle = INK_PAPER;
    const done = Math.max(0, Math.min(1, goal.progress));
    if (done > 0) ctx.fillRect(PAD + 2, barY + 2, (inner - 4) * done, BAR_H - 4);
  });

  const more = goals.length - MAX_ROWS;
  if (more > 0) {
    ctx.fillStyle = BG_NIGHT;
    ctx.globalAlpha = 0.75;
    ctx.font = `400 ${FOOT_PX}px ${faces.mono}`;
    ctx.fillText(`and ${more} more`, PAD, SCREEN_H - PAD + FOOT_PX / 2);
  }
}

/** The screen texture, redrawn whenever a goal's summary changes. */
export function useGoalsScreen(): CanvasTexture {
  const goals = useAppStore((s) => s.goals);
  const hydrated = useAppStore((s) => s.hydrated);
  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, faces: ScreenFaces) => draw(ctx, goals, hydrated, faces),
    [goals, hydrated],
  );
  return useCanvasScreen(paint);
}
