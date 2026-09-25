// The journal's mood picker and topic tags — FR-3.1 (≤ 8 emoji options).
//
// Shared by the entry form and the reflect route, so the key stored in
// journal_entries.mood always has a score the calendar can colour (FR-3.5).
// The score is stored beside the key (03 §3); it is never shown as a number.
//
// No mood is labelled good or bad. The score only orders them for the
// calendar, which renders warmth present or absent, not a verdict.

export interface Mood {
  key: string;
  emoji: string;
  label: string;
  /** -2 … 2, journal_entries.mood_score. */
  score: -2 | -1 | 0 | 1 | 2;
}

export const MOODS: readonly Mood[] = [
  { key: 'bright', emoji: '😄', label: 'bright', score: 2 },
  { key: 'content', emoji: '🙂', label: 'content', score: 1 },
  { key: 'calm', emoji: '😌', label: 'calm', score: 1 },
  { key: 'neutral', emoji: '😐', label: 'neutral', score: 0 },
  { key: 'tired', emoji: '😴', label: 'tired', score: -1 },
  { key: 'anxious', emoji: '😟', label: 'anxious', score: -1 },
  { key: 'low', emoji: '😔', label: 'low', score: -2 },
  { key: 'frustrated', emoji: '😤', label: 'frustrated', score: -2 },
];

export const MOOD_KEYS = MOODS.map((m) => m.key) as [string, ...string[]];

export function moodScore(key: string): Mood['score'] | null {
  return MOODS.find((m) => m.key === key)?.score ?? null;
}

export const TOPIC_TAGS: readonly string[] = [
  'work', 'health', 'relationships', 'learning', 'rest', 'money', 'creativity', 'home',
];

/** FR-3.1 — prevented at input with a visible counter (AC-3.4), and checked again server-side. */
export const MAX_ENTRY_CHARS = 2000;
