'use client';

// Monitor 1's panel — today's challenge in the room (build plan 3.1, F1).
//
// The monitor's screen carries the challenge as texture; this is the legible,
// actionable version (spec/05 §3, the 5 % rule). Same store, same write paths
// and same sentences as /text (D-07).

import { useState } from 'react';

import { rollReason as rollReasonFor } from '../../../lib/challenge/copy';
import { completeChallenge, rollChallenge } from '../../../lib/data/challenge';
import { useAppStore } from '../../../lib/stores/app';
import { useInteractionStore } from '../../../lib/stores/interaction';

import { Skeleton } from '../text/Skeleton';
import voice from '../text/text.module.css';

export function ChallengePanel() {
  const challenge = useAppStore((s) => s.challenge);
  const hydrated = useAppStore((s) => s.hydrated);
  const focusObject = useInteractionStore((s) => s.focusObject);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    await task();
    setBusy(false);
  }

  // X-2: a skeleton while the store fills, never a bare spinner.
  if (!hydrated) return <Skeleton />;

  // FR-1.7: a welcome that routes to import. The phone is the import, so the
  // route is a glide to it rather than a form here.
  if (!challenge) {
    return (
      <>
        <p className={voice.quiet}>
          Nothing saved yet. The phone turns an article into one thing you can do in two minutes — and one of
          them is waiting on this screen each morning.
        </p>
        <div className={voice.row}>
          <button type="button" className={voice.primary} onClick={() => focusObject('phone', 'import')}>
            pick up the phone
          </button>
        </div>
      </>
    );
  }

  const rollReason = rollReasonFor(challenge);
  const id = challenge.id;

  return (
    <>
      <p className={voice.prose}>{challenge.actionText}</p>
      {challenge.sourceSummary && <p className={voice.quiet}>{challenge.sourceSummary}</p>}
      {challenge.sourceUrl && <p className={voice.faint}>{challenge.sourceUrl}</p>}

      {challenge.complete ? (
        <p className={voice.label}>done today</p>
      ) : (
        <div className={voice.row}>
          <button
            type="button"
            className={voice.primary}
            disabled={busy || !id}
            onClick={() => id && run(() => completeChallenge(id))}
          >
            do it now — mark done
          </button>
          <button
            type="button"
            className={voice.action}
            disabled={busy || challenge.rollsRemaining === 0}
            aria-describedby={rollReason ? 'panel-roll-reason' : undefined}
            onClick={() => id && run(() => rollChallenge(id))}
          >
            roll again · {challenge.rollsRemaining} left
          </button>
        </div>
      )}
      {rollReason && (
        <p id="panel-roll-reason" className={voice.faint}>
          {rollReason}
        </p>
      )}
    </>
  );
}
