// The history slice — every habit's year, archived ones included, for the
// hall's wall and /text's history (design-system/13-door-scene.md §8).
//
// Loaded on demand, the first time something needs it, not at hydrate: the
// room never shows it, and it is the largest read in the product. After that,
// every habit refresh reloads it (lib/data/habits.ts), so the wall never shows
// a day the room has moved past. Signed out it is empty, not missing.

import { HISTORY_DAYS, historyRow, type HistoryRow } from '../history';
import { useAppStore } from '../stores/app';
import { getSession, shiftDate, today, type DataSession } from './session';
import { localDate } from './time';
import { write } from './write';

interface Frequency {
  days?: number[];
}

export async function loadHistory(session: DataSession): Promise<HistoryRow[]> {
  const { supabase, userId, timeZone } = session;
  const date = today(session);
  const first = shiftDate(date, -(HISTORY_DAYS - 1));

  const [habitsResult, logsResult] = await Promise.all([
    supabase
      .from('habits')
      .select('id, name, type, frequency, streak, longest_streak, created_at, archived_at')
      .eq('user_id', userId)
      // Active habits first, in the habits panel's order; archived after them.
      .order('archived_at', { ascending: true, nullsFirst: true })
      .order('created_at'),
    supabase
      .from('habit_logs')
      .select('habit_id, date')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('date', first),
  ]);
  if (habitsResult.error) throw habitsResult.error;
  if (logsResult.error) throw logsResult.error;

  const kept = new Map<string, Set<string>>();
  for (const log of logsResult.data ?? []) {
    const set = kept.get(log.habit_id) ?? new Set<string>();
    set.add(log.date);
    kept.set(log.habit_id, set);
  }

  return (habitsResult.data ?? []).map((h) =>
    historyRow(
      {
        id: h.id,
        name: h.name,
        type: h.type,
        archived: h.archived_at !== null,
        dueDays: (h.frequency as Frequency | null)?.days ?? [],
        born: localDate(timeZone, new Date(h.created_at)),
        storedStreak: h.streak,
        storedLongest: h.longest_streak,
        kept: kept.get(h.id) ?? new Set(),
      },
      date,
    ),
  );
}

/**
 * Loads the history once the room is hydrated, for whichever surface asks
 * first. Before hydrate it does nothing — the session is not known yet, and
 * hydrate resets the slice anyway. A failed read leaves it unloaded: the wall
 * stays bare, the panel says it is loading, never an error, and the next ask
 * tries again.
 */
export async function ensureHistory(): Promise<void> {
  const { hydrated, history } = useAppStore.getState();
  if (!hydrated || history !== null) return;
  const session = getSession();
  if (!session) {
    write({ history: [] });
    return;
  }
  try {
    write({ history: await loadHistory(session) });
  } catch {
    // Unloaded; asked for again next time.
  }
}
