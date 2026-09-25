// The last known store, on this device, for offline (B2.9, spec/05 §7):
// "Offline: the room renders from the last cached store snapshot and the
// /text route serves the shell."
//
// Keyed to the user, so a shared device never shows one person's room to the
// next, and cleared on sign-out. It holds only what the store holds — which
// has never included journal text (FR-3.6): the journal slice is two numbers.

import type { AppState } from '../stores/app';

const KEY = 'bbe:snapshot:v1';

type Persisted = Pick<AppState, 'challenge' | 'points' | 'habits' | 'dayGrid' | 'journal' | 'goals'>;

interface Snapshot {
  userId: string;
  savedAt: string;
  state: Persisted;
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null; // private mode, blocked storage
  }
}

export function saveSnapshot(userId: string, state: AppState): void {
  const store = storage();
  if (!store) return;
  const { challenge, points, habits, dayGrid, journal, goals } = state;
  const snapshot: Snapshot = {
    userId,
    savedAt: new Date().toISOString(),
    state: { challenge, points, habits, dayGrid, journal, goals },
  };
  try {
    store.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or blocked: offline just shows the default room instead.
  }
}

export function readSnapshot(userId: string): Persisted | null {
  const raw = storage()?.getItem(KEY);
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(raw) as Snapshot;
    return snapshot.userId === userId ? snapshot.state : null;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
