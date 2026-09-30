// The focus timer's arithmetic (A5.2, D-24 §6), apart from the store so it can
// be tested on its own. lib/data/focus.ts does the writing and the timeout.

import type { AppState } from './stores/app.ts';

/** spec/00: the headphones' "two-minute timer". */
export const FOCUS_MS = 2 * 60 * 1000;

/** What the store holds with focus on or off at `now`. */
export function focusPatch(on: boolean, now: number): Pick<AppState, 'focusMode' | 'focusEndsAt'> {
  return { focusMode: on, focusEndsAt: on ? now + FOCUS_MS : null };
}

/** "m:ss" left on the timer at `now`, never below 0:00. */
export function formatRemaining(endsAt: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
