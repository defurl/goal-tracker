// FALLBACK-1 — the user never sees an AI error (spec/04-ai-agents.md §1).
// Every failure path ends here instead.
//
// Extraction: at least 20 generic two-minute actions, "enough that a user
// hitting the fallback path twice in a week does not see the same one" (04 §2).
// Each obeys the extraction prompt's own rules — imperative verb first, at most
// 40 words, no motivational filler — because the user cannot tell them apart
// from a real extraction and should not be able to.

import type { JournalReflection } from './journalAnalysis.ts';

/** Marks a fallback row in user_actions, so the next pick can avoid repeats. */
export const FALLBACK_SOURCE_SUMMARY = 'Fallback action';

export const CURATED_FALLBACK_ACTIONS: readonly string[] = [
  'Write down the one task that would make today feel finished, and put it at the top of your list.',
  'Drink a full glass of water before you do anything else.',
  'Stand up and stretch your arms overhead for thirty seconds.',
  'Send a two-line message to someone you have not spoken to in a month.',
  'Clear everything off one small surface near you.',
  'Close every browser tab you will not use in the next hour.',
  'Write three things you noticed today, however small.',
  'Set a timer for two minutes and tidy the space in front of you until it rings.',
  'Take ten slow breaths, counting four in and six out.',
  'Put your phone in another room for the next thirty minutes.',
  'Block fifteen minutes in tomorrow’s calendar for the task you keep postponing.',
  'Write the next single physical step of your biggest project on a sticky note.',
  'Step outside or open a window and look at the farthest thing you can see for one minute.',
  'Unsubscribe from one email list you never read.',
  'Refill your water bottle and leave it where you will see it.',
  'Write one sentence about what you want tomorrow morning to feel like.',
  'Thank one person, by message, for something specific they did recently.',
  'Delete ten photos or screenshots you no longer need.',
  'Choose tonight’s bedtime and set an alarm thirty minutes before it.',
  'Walk to the far end of your home and back, slowly.',
  'Write down one worry, then one thing within your control about it.',
  'Put away three objects that are out of place.',
  'Read one paragraph of a book you have been meaning to start.',
  'Roll your shoulders back five times and unclench your jaw.',
];

/**
 * The reflection shown when the agent is not reached — the provider failed,
 * or the user has spent their three reflections today (429).
 *
 * 04 §3's edge case: this is the one message that ships with no awareness of
 * what was written, and the entry may have been a hard one. So it is neutral
 * and gentle, never breezily upbeat, and it asks nothing of the user. It names
 * no emotion, because it has not read one.
 */
export const GENTLE_REFLECTION: JournalReflection = {
  primary_emotion: '',
  strength: 'You made time to put today into words.',
  next_action: 'Take a slow breath before you move on to whatever comes next.',
  summary: 'Your entry is saved with its mood and tags. There is no reflection to add this time.',
  support_response: false,
};

/**
 * A fallback the user has not been given before, while any remain; after
 * that, any of them. `used` is the action text of their earlier fallbacks.
 */
export function pickFallbackAction(used: readonly string[], random: () => number = Math.random): string {
  const seen = new Set(used);
  const fresh = CURATED_FALLBACK_ACTIONS.filter((a) => !seen.has(a));
  const pool = fresh.length > 0 ? fresh : CURATED_FALLBACK_ACTIONS;
  return pool[Math.floor(random() * pool.length)] ?? (CURATED_FALLBACK_ACTIONS[0] as string);
}
