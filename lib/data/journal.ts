// Feature 3 — the journal.
//
// Saving without AI Reflect writes mood, tags and the day straight through
// RLS; there is no entry text to write, because journal_entries has no column
// for one (FR-3.6). With AI Reflect, the text goes to /api/agent/reflect in
// the request body and nowhere else: it is not put in the store, not cached,
// not kept in this module after the call returns.
//
// Reflect is only ever called from a direct activation (D-16, AC-3.6).

import type { AppState } from '../stores/app';
import { moodScore } from '../journal/moods';
import type { JournalReflection } from '../prompts/journalAnalysis';
import { getSession, shiftDate, today, type DataSession } from './session';
import { secondsIntoLocalDay } from './time';
import { write } from './write';

const REFLECTIONS_PER_DAY = 3; // spec/04 §3

export async function loadJournal(session: DataSession): Promise<AppState['journal']> {
  const { supabase, userId, timeZone } = session;
  const localMidnight = new Date(Date.now() - secondsIntoLocalDay(timeZone) * 1000).toISOString();

  const [entry, calls] = await Promise.all([
    supabase.from('journal_entries').select('id').eq('user_id', userId).eq('date', today(session)).maybeSingle(),
    // agent_logs is readable by its owner (012); a reflection is one row.
    supabase
      .from('agent_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('agent_id', 'journal_analysis_agent')
      .gte('created_at', localMidnight),
  ]);

  return {
    todayLogged: Boolean(entry.data),
    reflectionsRemaining: Math.max(0, REFLECTIONS_PER_DAY - (calls.count ?? 0)),
  };
}

export interface JournalDay {
  date: string;
  mood: string;
  moodScore: number;
  tags: string[];
  insight: { summary: string; emotion: string; strength: string; nextAction: string } | null;
}

/** US-3.5 — the last `days` days, for the calendar and today's AI Insight. Not in the store. */
export async function loadJournalDays(days = 35): Promise<JournalDay[]> {
  const session = getSession();
  if (!session) return [];
  const { data } = await session.supabase
    .from('journal_entries')
    .select('date, mood, mood_score, tags, ai_summary, ai_emotion, ai_strength, ai_next_action')
    .eq('user_id', session.userId)
    .gte('date', shiftDate(today(session), -(days - 1)))
    .order('date');
  return (data ?? []).map((row) => ({
    date: row.date,
    mood: row.mood,
    moodScore: row.mood_score,
    tags: row.tags,
    insight: row.ai_summary
      ? {
          summary: row.ai_summary,
          emotion: row.ai_emotion ?? '',
          strength: row.ai_strength ?? '',
          nextAction: row.ai_next_action ?? '',
        }
      : null,
  }));
}

async function refresh(session: DataSession): Promise<void> {
  write({ journal: await loadJournal(session) });
}

/** AI Reflect off (AC-3.1): mood, tags and the day. Nothing else exists to store. */
export async function saveEntry(input: { mood: string; tags: string[] }): Promise<boolean> {
  const session = getSession();
  if (!session) return false;
  const { error } = await session.supabase.from('journal_entries').upsert(
    {
      user_id: session.userId,
      date: today(session),
      mood: input.mood,
      mood_score: moodScore(input.mood) ?? 0,
      tags: input.tags,
    },
    { onConflict: 'user_id,date' },
  );
  await refresh(session);
  return !error;
}

export type ReflectOutcome =
  | { kind: 'reflected'; reflection: JournalReflection; fallback: boolean }
  | { kind: 'signed_out' }
  | { kind: 'unavailable' };

/**
 * AI Reflect on (D-16). The entry is saved with the reflection by the route.
 * A 429 still carries a gentle reflection (04 §3), so it is not a failure here.
 */
export async function reflect(input: { entryText: string; mood: string; tags: string[] }): Promise<ReflectOutcome> {
  const session = getSession();
  if (!session) return { kind: 'signed_out' };
  try {
    const response = await fetch('/api/agent/reflect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_text: input.entryText, mood: input.mood, tags: input.tags }),
    });
    if (response.status === 401) return { kind: 'signed_out' };
    if (response.status !== 200 && response.status !== 429) return { kind: 'unavailable' };
    const body = (await response.json()) as { reflection: JournalReflection; fallback: boolean };
    await refresh(session);
    return { kind: 'reflected', reflection: body.reflection, fallback: body.fallback };
  } catch {
    return { kind: 'unavailable' };
  }
}
