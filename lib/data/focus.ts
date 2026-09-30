// Focus mode — the headphones' toggle and the corner's audio control, which
// flip the same boolean (design-system/08 §4, §7; build plan 3.8).
//
// The data layer is the store's only writer (spec/05 §6), so both controls
// come through here. It is deliberately NOT persisted: audio is off by
// default on every visit, and a remembered "on" would mean sound starting
// without a gesture — the auto-play the anti-patterns forbid.
//
// Turning focus on starts the two-minute timer (spec/00, A5.2, D-24 §6). When
// it runs out focus turns off, so the bed fades out over its usual 600 ms, and
// nothing else happens: no chime, no alert. The end time is in the store for
// the countdowns to read; the timeout that ends it lives here, beside the
// only writer.

import { FOCUS_MS, focusPatch } from '../focusTimer';
import { useAppStore } from '../stores/app';
import { write } from './write';

let ending: ReturnType<typeof setTimeout> | null = null;

export function setFocusMode(on: boolean): void {
  if (ending) clearTimeout(ending);
  ending = on ? setTimeout(() => setFocusMode(false), FOCUS_MS) : null;
  write(focusPatch(on, Date.now()));
}

export function toggleFocusMode(): void {
  setFocusMode(!useAppStore.getState().focusMode);
}
