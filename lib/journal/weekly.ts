// J04 — the week in counts, from what the user explicitly recorded: moods,
// energy and tags. Counts and averages with their sample size, never a cause
// and never a verdict. Pure, so it runs the same on any surface and in tests.

import { shiftDate } from '../dates.ts';
import type { DeviceEntry } from './deviceStore.ts';

export interface WeekSummary {
  from: string;
  to: string;
  entries: number;
  /** Distinct days with at least one entry. */
  days: number;
  moods: { key: string; count: number }[];
  tags: { key: string; count: number }[];
  /** Mean of the entries that recorded energy, or null with none. */
  energy: { mean: number; samples: number } | null;
}

function ranked(counts: Map<string, number>): { key: string; count: number }[] {
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** The seven days ending on `to` (inclusive), both YYYY-MM-DD. */
export function summariseWeek(entries: readonly DeviceEntry[], to: string): WeekSummary {
  const from = shiftDate(to, -6);
  const inWeek = entries.filter((e) => e.localDate >= from && e.localDate <= to);
  const moods = new Map<string, number>();
  const tags = new Map<string, number>();
  const energies: number[] = [];
  for (const e of inWeek) {
    for (const m of e.moods) moods.set(m, (moods.get(m) ?? 0) + 1);
    for (const t of e.tags) tags.set(t, (tags.get(t) ?? 0) + 1);
    if (e.energy !== null) energies.push(e.energy);
  }
  return {
    from,
    to,
    entries: inWeek.length,
    days: new Set(inWeek.map((e) => e.localDate)).size,
    moods: ranked(moods),
    tags: ranked(tags),
    energy: energies.length
      ? { mean: Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 10) / 10, samples: energies.length }
      : null,
  };
}

/** Below this many entries the board says there is not enough to read a trend (J04, UI copy). */
export const MIN_TREND_ENTRIES = 3;
