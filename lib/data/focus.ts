// Focus mode — the headphones' toggle and the corner's audio control, which
// flip the same boolean (design-system/08 §4, §7; build plan 3.8).
//
// The data layer is the store's only writer (spec/05 §6), so both controls
// come through here. It is deliberately NOT persisted: audio is off by
// default on every visit, and a remembered "on" would mean sound starting
// without a gesture — the auto-play the anti-patterns forbid.

import { useAppStore } from '../stores/app';
import { write } from './write';

export function setFocusMode(on: boolean): void {
  write({ focusMode: on });
}

export function toggleFocusMode(): void {
  setFocusMode(!useAppStore.getState().focusMode);
}
