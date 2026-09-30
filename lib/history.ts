// One habit's year, for the hall's history wall and /text's history
// (design-system/13-door-scene.md §4, §8; build plan A5.8, A5.9). Pure, so the
// arithmetic is tested without a database.
//
// The current streak follows log_habit()'s rule exactly (020): consecutive
// completed DUE days ending today; today not yet done does not break the run,
// the day is not over; a day before the habit existed ends it. The stored
// `habits.streak` is only recomputed at a check-off, so after a missed day it
// is stale until the next one. This is computed from the days themselves.

import { shiftDate, weekday } from './dates.ts';
import type { DayCell } from './stores/app.ts';

/** The wall's year, as the room's wall grid (spec/05 §3). */
export const HISTORY_DAYS = 365;

export interface HabitHistoryInput {
  id: string;
  name: string;
  type: 'build' | 'break';
  archived: boolean;
  /** Due weekdays, 0 = Sunday (habits.frequency.days). */
  dueDays: readonly number[];
  /** The local date the habit was created. */
  born: string;
  /** habits.streak — used only when the run reaches past the wall's year. */
  storedStreak: number;
  /** habits.longest_streak — its lookback is 400 days, longer than the wall's. */
  storedLongest: number;
  /** Local dates it was completed, at least those inside the year. */
  kept: ReadonlySet<string>;
}

export interface HistoryRow {
  id: string;
  name: string;
  type: 'build' | 'break';
  archived: boolean;
  /** D-09's primary number. */
  longestStreak: number;
  /** 0 for an archived habit: it has no "now". */
  currentStreak: number;
  keptThisYear: number;
  /** HISTORY_DAYS cells, oldest first: 0 not kept, 1 kept, 2 kept today. */
  days: DayCell[];
  /** The longest run on the wall, as indices into `days` (inclusive), or null. */
  longestRun: { from: number; to: number } | null;
}

export function historyRow(habit: HabitHistoryInput, today: string): HistoryRow {
  const first = shiftDate(today, -(HISTORY_DAYS - 1));
  const due = (date: string) => date >= habit.born && habit.dueDays.includes(weekday(date));

  const days: DayCell[] = [];
  let keptThisYear = 0;
  // The longest run inside the year: non-due days neither extend nor break it.
  let run = 0;
  let runFrom = -1;
  let best: { length: number; from: number; to: number } | null = null;

  for (let i = 0; i < HISTORY_DAYS; i++) {
    const date = shiftDate(first, i);
    const kept = habit.kept.has(date);
    days.push(kept ? (date === today ? 2 : 1) : 0);
    if (kept) keptThisYear++;
    if (!due(date)) continue;
    if (kept) {
      if (run === 0) runFrom = i;
      run++;
      // >= so that of two equal runs the more recent one is marked.
      if (!best || run >= best.length) best = { length: run, from: runFrom, to: i };
    } else if (date !== today) {
      run = 0;
    }
  }

  const current = habit.archived ? 0 : currentStreak(habit, today, first, due);
  return {
    id: habit.id,
    name: habit.name,
    type: habit.type,
    archived: habit.archived,
    longestStreak: Math.max(habit.storedLongest, best?.length ?? 0, current),
    currentStreak: current,
    keptThisYear,
    days,
    longestRun: best ? { from: best.from, to: best.to } : null,
  };
}

function currentStreak(habit: HabitHistoryInput, today: string, first: string, due: (d: string) => boolean): number {
  let run = 0;
  for (let date = today; date >= first; date = shiftDate(date, -1)) {
    if (date < habit.born) return run;
    if (!due(date)) continue;
    if (habit.kept.has(date)) run++;
    else if (date !== today) return run;
  }
  // The run reaches past the wall's year: the stored value, counted with a
  // longer lookback at the last check-off, is the better guide.
  return Math.max(run, habit.storedStreak);
}
