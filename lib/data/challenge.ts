// Feature 1 — the Daily Challenge and the import that feeds it.
//
// Writes go through the server: import through /api/agent/extract, complete
// and roll through the 019 functions, which award and cap in the database.
// The store is written after the server answers (spec/05 §6).

import type { Challenge } from '../stores/app';
import { loadPoints } from './points';
import { getSession, today, type DataSession } from './session';
import { write } from './write';

const ROLL_CAP = 3; // D-15

export async function loadChallenge(session: DataSession): Promise<Challenge | null> {
  const { supabase, userId } = session;
  const date = today(session);

  const read = () =>
    supabase
      .from('daily_challenges')
      .select('id, action_id, roll_count, completed_at, user_actions(action_text, source_summary, source_url)')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

  let { data: row } = await read();
  if (!row) {
    // Before the next hourly sweep, a user with a pending action still gets one.
    await supabase.rpc('ensure_daily_challenge');
    ({ data: row } = await read());
  }
  if (!row) return null; // FR-1.7: no pending actions — the empty state, not an error

  const { count: otherPending } = await supabase
    .from('user_actions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'pending')
    .neq('id', row.action_id);

  const action = Array.isArray(row.user_actions) ? row.user_actions[0] : row.user_actions;
  const rollsLeft = ROLL_CAP - row.roll_count;
  return {
    id: row.id,
    actionText: action?.action_text ?? '',
    sourceSummary: action?.source_summary ?? '',
    sourceUrl: action?.source_url ?? null,
    complete: row.completed_at !== null,
    rollCount: row.roll_count,
    // Zero when capped OR when there is nothing else to roll to; the UI tells
    // the two apart by rollCount, so the stated reason is the true one.
    rollsRemaining: row.completed_at === null && (otherPending ?? 0) > 0 ? Math.max(0, rollsLeft) : 0,
  };
}

async function refresh(session: DataSession): Promise<void> {
  const [challenge, points] = await Promise.all([
    loadChallenge(session),
    loadPoints(session.supabase, session.userId, today(session)),
  ]);
  write({ challenge, points });
}

export type ImportOutcome =
  | { kind: 'imported'; actionText: string; sourceUnreadable: boolean }
  | { kind: 'limited' }
  | { kind: 'invalid' }
  | { kind: 'unavailable' }
  | { kind: 'signed_out' };

/** US-1.1. The phone screen warms while `importing` is true (spec/05 §3). */
export async function importAction(input: { url: string } | { text: string }): Promise<ImportOutcome> {
  const session = getSession();
  if (!session) return { kind: 'signed_out' };

  write({ importing: true });
  try {
    const response = await fetch('/api/agent/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (response.status === 429) return { kind: 'limited' };
    if (response.status === 400) return { kind: 'invalid' };
    if (response.status === 401) return { kind: 'signed_out' };
    if (!response.ok) return { kind: 'unavailable' };

    const body = (await response.json()) as {
      action: { actionText: string };
      sourceUnreadable: boolean;
    };
    await refresh(session);
    return { kind: 'imported', actionText: body.action.actionText, sourceUnreadable: body.sourceUnreadable };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    write({ importing: false });
  }
}

export async function completeChallenge(id: string): Promise<void> {
  const session = getSession();
  if (!session) return;
  await session.supabase.rpc('complete_challenge', { p_challenge_id: id });
  await refresh(session);
}

export async function rollChallenge(id: string): Promise<void> {
  const session = getSession();
  if (!session) return;
  await session.supabase.rpc('roll_challenge', { p_challenge_id: id });
  await refresh(session);
}
