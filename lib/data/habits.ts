// Feature 2 — habits, the day grid, and check-off.
//
// Check-off is the one optimistic write in the product (FR-2.8, spec/05 §6):
// the tick and a predicted total land in the store at once, log_habit() (020)
// awards on the server, and the reload that follows overwrites the prediction.
// When the two disagree the server wins silently — no toast, no flash.

import { leafCountForPoints } from '../growth';
import type { AppState, DayCell, HabitSummary } from '../stores/app';
import { useAppStore } from '../stores/app';
import { loadPoints } from './points';
import { getSession, shiftDate, today, weekday, type DataSession } from './session';
import { write } from './write';

export const HABIT_CAP = 10; // FR-2.1
const GRID_DAYS = 365;

interface Frequency {
  days?: number[];
}

function dueOn(frequency: unknown, date: string): boolean {
  const days = (frequency as Frequency | null)?.days;
  return Array.isArray(days) && days.includes(weekday(date));
}

export async function loadHabits(
  session: DataSession,
): Promise<{ habits: HabitSummary[]; dayGrid: DayCell[] }> {
  const { supabase, userId } = session;
  const date = today(session);
  const first = shiftDate(date, -(GRID_DAYS - 1));

  const [habitsResult, logsResult] = await Promise.all([
    supabase
      .from('habits')
      .select('id, name, type, frequency, streak, longest_streak')
      .eq('user_id', userId)
      .is('archived_at', null)
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

  const logs = logsResult.data ?? [];
  const doneToday = new Set(logs.filter((l) => l.date === date).map((l) => l.habit_id));
  const filledDays = new Set(logs.map((l) => l.date));

  const habits: HabitSummary[] = (habitsResult.data ?? []).map((h) => ({
    id: h.id,
    name: h.name,
    type: h.type,
    dueToday: dueOn(h.frequency, date),
    completedToday: doneToday.has(h.id),
    streak: h.streak,
    longestStreak: h.longest_streak,
  }));

  // Oldest first; today is always the bright cell, filled or not (spec/05 §3).
  const dayGrid: DayCell[] = [];
  for (let i = GRID_DAYS - 1; i >= 0; i--) {
    const day = shiftDate(date, -i);
    dayGrid.push(i === 0 ? 2 : filledDays.has(day) ? 1 : 0);
  }
  return { habits, dayGrid };
}

async function refresh(session: DataSession): Promise<void> {
  const [slice, points] = await Promise.all([
    loadHabits(session),
    loadPoints(session.supabase, session.userId, today(session)),
  ]);
  write({ ...slice, points });
}

export type CreateHabitOutcome = 'created' | 'cap_reached' | 'invalid' | 'unavailable' | 'signed_out';

export async function createHabit(input: {
  name: string;
  type: 'build' | 'break';
  days: number[];
}): Promise<CreateHabitOutcome> {
  const session = getSession();
  if (!session) return 'signed_out';
  const name = input.name.trim();
  if (name.length < 1 || name.length > 80 || input.days.length === 0) return 'invalid';

  const { error } = await session.supabase.from('habits').insert({
    user_id: session.userId,
    name,
    type: input.type,
    frequency: { days: [...new Set(input.days)].sort() },
  });
  if (error) return /habit_cap_reached/.test(error.message) ? 'cap_reached' : 'unavailable';
  await refresh(session);
  return 'created';
}

/** FR-2.8: feedback before the server answers, reconciled silently after. */
export async function checkHabit(id: string, completed: boolean): Promise<void> {
  const session = getSession();
  if (!session) return;

  const state = useAppStore.getState();
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return;

  // A prediction, not a write of the score: the reload below replaces it (X-6).
  const predicted = completed && !habit.completedToday ? (habit.type === 'build' ? 10 : 15) : 0;
  const total = state.points.total + predicted;
  const points: AppState['points'] = {
    total,
    today: state.points.today + predicted,
    // Derived in exactly one place, even for a prediction (spec/05 §4).
    leafCount: leafCountForPoints(total),
  };
  write({
    habits: state.habits.map((h) => (h.id === id ? { ...h, completedToday: completed } : h)),
    points,
  });

  await session.supabase.rpc('log_habit', { p_habit_id: id, p_completed: completed });
  await refresh(session).catch(() => undefined);
}

/** Archived, never deleted: its logs are the history the wall grid shows (03 §2). */
export async function archiveHabit(id: string): Promise<void> {
  const session = getSession();
  if (!session) return;
  await session.supabase
    .from('habits')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', session.userId);
  await refresh(session);
}
