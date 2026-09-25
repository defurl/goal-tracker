// The ONE place useAppStore is written (spec/05 §6). Every loader in lib/data/
// goes through `write`, and nothing outside lib/data/ may call setState. Not yet
// lint-enforced — a no-restricted-syntax rule for it is proposed in PROGRESS.md.
//
// Write discipline (spec/05 §6): write after the server confirms. The single
// exception — optimistic habit check-off, FR-2.8 (lib/data/habits.ts) — is
// reconciled by the reload that follows, and the server wins silently.
//
// Every write while someone is signed in also refreshes their offline
// snapshot (lib/data/snapshot.ts), debounced so a burst of writes saves once.

import { useAppStore, type AppState } from '../stores/app';
import { getSession } from './session';
import { saveSnapshot } from './snapshot';

let pending: ReturnType<typeof setTimeout> | null = null;

export function write(patch: Partial<AppState>): void {
  useAppStore.setState(patch);

  const session = getSession();
  if (!session || typeof window === 'undefined') return;
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    const current = getSession();
    // Only a settled, online state for the same user is worth keeping.
    const state = useAppStore.getState();
    if (current?.userId === session.userId && state.hydrated && !state.offline) {
      saveSnapshot(session.userId, state);
    }
  }, 500);
}
