// Feature 1's user-facing sentences, shared by /text and the room's panels so
// the two surfaces never tell the user different things (D-07).
//
// None of them is an error message: every import outcome reads as a calm
// statement of what happened (FALLBACK-1, X-5).

import type { ImportOutcome } from '../data/challenge';
import type { Challenge } from '../stores/app';

export function importMessage(outcome: ImportOutcome): string {
  switch (outcome.kind) {
    case 'imported':
      return outcome.sourceUnreadable
        ? 'That page could not be read, so this one is a starter action. Paste the article’s text for one drawn from it.'
        : 'Saved to your actions.';
    case 'limited':
      return 'Twenty imports today. The rest can wait for tomorrow.';
    case 'invalid':
      return 'That does not look like a link or any text.';
    case 'signed_out':
      return 'Sign in to save actions.';
    case 'unavailable':
      return 'Not saved — the connection dropped. Try again in a moment.';
  }
}

/** FR-1.5: at the cap the control disables with a stated reason, never vanishes. */
export function rollReason(challenge: Challenge | null): string | null {
  if (!challenge || challenge.complete || challenge.rollsRemaining > 0) return null;
  return challenge.rollCount >= 3
    ? 'Three rolls a day — this one is today’s.'
    : 'Import another action to have something to roll to.';
}
