'use client';

// A route's tabs live in the hash (`/journal#history`, `/journal#prompt/grateful`),
// so a tab deep links and Back steps through tabs, while the route itself
// stays the source of truth for the room (handoff 03 §2).

import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const read = () => window.location.hash.replace(/^#/, '');

export function useHashPath(): string[] {
  const hash = useSyncExternalStore(subscribe, read, () => '');
  return hash ? hash.split('/').map(decodeURIComponent) : [];
}

/** Moves to `#a/b`, as a history entry; no arguments clears the hash. */
export function setHashPath(...parts: string[]): void {
  if (parts.length === 0) {
    history.pushState(null, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  const next = `#${parts.map(encodeURIComponent).join('/')}`;
  if (window.location.hash !== next) window.location.hash = next;
}
