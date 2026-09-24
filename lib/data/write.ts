// The ONE place useAppStore is written (spec/05 §6). Every loader in lib/data/
// goes through `write`, and nothing outside lib/data/ may call setState. Not yet
// lint-enforced — a no-restricted-syntax rule for it is proposed in PROGRESS.md.
//
// Write discipline (spec/05 §6): write after the server confirms. The single
// exception — optimistic habit check-off, FR-2.8 — lands with its feature, and
// when it reconciles, the server wins silently.

import { useAppStore, type AppState } from '../stores/app';

export function write(patch: Partial<AppState>): void {
  useAppStore.setState(patch);
}
