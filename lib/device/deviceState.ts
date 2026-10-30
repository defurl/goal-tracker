'use client';

// Small per-account state kept on this device: Self Care sessions, routines
// and feedback; Skills saves, progress and private takeaways. localStorage,
// keyed `bbe-<name>:<owner>`, so two accounts on one browser never see each
// other's. Moves to owner-only tables when the catalogues move to the CMS;
// until then it stays private by construction (functional specification §9).

import { useCallback, useSyncExternalStore } from 'react';

import { currentOwner } from '../journal/device';

const listeners = new Set<() => void>();
const cache = new Map<string, unknown>();

function keyFor(name: string): string {
  return `bbe-${name}:${currentOwner()}`;
}

function read<T>(key: string, initial: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let value = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw) value = { ...initial, ...(JSON.parse(raw) as T) };
  } catch {
    // Unreadable or refused: start from the initial state.
  }
  cache.set(key, value);
  return value;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useDeviceState<T extends object>(name: string, initial: T): [T, (update: (current: T) => T) => void] {
  // currentOwner() changes with the session; callers re-render on sign-in.
  const key = typeof window === 'undefined' ? '' : keyFor(name);
  const value = useSyncExternalStore(
    subscribe,
    () => read(key, initial),
    () => initial,
  );
  const set = useCallback(
    (update: (current: T) => T) => {
      const next = update(read(key, initial));
      cache.set(key, next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Kept in memory for this visit.
      }
      listeners.forEach((l) => l());
    },
    [key, initial],
  );
  return [value, set];
}

/** Sign-out and account deletion clear this account's device state. */
export function clearDeviceState(owner = currentOwner()): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      // Module state ends with the owner; journal drafts carry it in the middle.
      if (k?.startsWith('bbe-') && (k.endsWith(`:${owner}`) || k.startsWith(`bbe-journal-draft:${owner}:`))) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // Nothing to clear.
  }
  cache.clear();
  listeners.forEach((l) => l());
}
