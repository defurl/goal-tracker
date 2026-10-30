'use client';

// The board shell and the challenge card — Phase 7 P0's board test.
//
// Same store, same write paths and same rules as /text's ChallengeSection: the
// challenge is completed through completeChallenge(), skipped through
// rollChallenge() (D-15's "skip", amended by D-26), and nothing here judges a
// day that was missed. Only the presentation is new: design-system/v2.

import Link from 'next/link';
import { useState } from 'react';

import { rollReason as rollReasonFor } from '../../../../lib/challenge/copy';
import { completeChallenge, rollChallenge } from '../../../../lib/data/challenge';
import { useAppStore } from '../../../../lib/stores/app';
import { useSurfaceState } from '../../useSurfaceState';

import styles from './board.module.css';

/** The design team's five modules (D-26 §2). Only Today exists in this test. */
const MODULES = ['Today', 'Journal', 'Growth Map', 'Skills', 'Self Care'] as const;

function greetingFor(hour: number): string {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function BoardTest() {
  const { ready, signedIn } = useSurfaceState();
  const challenge = useAppStore((s) => s.challenge);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    await task();
    setBusy(false);
  }

  const now = new Date();
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const rollReason = rollReasonFor(challenge);

  return (
    <div className={styles.board}>
      <div className={styles.backdrop} aria-hidden="true" />

      <header className={styles.bar}>
        <Link href="/" className={styles.home}>
          Room
        </Link>
        <nav aria-label="Modules" className={styles.menu}>
          <ul className={styles.menuList}>
            {MODULES.map((m) =>
              m === 'Today' ? (
                <li key={m}>
                  <a href="#today" aria-current="page" className={styles.menuItem}>
                    {m}
                  </a>
                </li>
              ) : (
                <li key={m}>
                  {/* Not built yet: shown so the layout is real, not reachable. */}
                  <span className={styles.menuItemOff} aria-disabled="true">
                    {m}
                  </span>
                </li>
              ),
            )}
          </ul>
        </nav>
        <span className={styles.barEnd} />
      </header>

      <main id="today" className={styles.content}>
        <div className={styles.intro}>
          <h1 className={styles.greeting}>{greetingFor(now.getHours())}</h1>
          <p className={styles.date}>{date}</p>
        </div>

        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="challenge-title">
            <div className={styles.cardHead}>
              <h2 id="challenge-title" className={styles.cardTitle}>
                Today’s challenge
              </h2>
              {signedIn && (
                <Link href="/text#import" className={styles.textAction}>
                  Add an article
                </Link>
              )}
            </div>

            {!ready ? (
              // X-2: the card's shape while the store fills, never a spinner.
              <div className={styles.skeleton} role="status" aria-label="Loading today’s challenge">
                <span className={styles.skeletonLine} />
                <span className={styles.skeletonLineShort} />
              </div>
            ) : challenge ? (
              <>
                <p className={styles.action}>{challenge.actionText}</p>
                {challenge.sourceSummary && <p className={styles.muted}>{challenge.sourceSummary}</p>}
                {challenge.sourceUrl && <p className={styles.source}>{challenge.sourceUrl}</p>}

                {challenge.complete ? (
                  <p className={styles.done}>Done today. A small step counts.</p>
                ) : (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={busy || !challenge.id}
                      onClick={() => challenge.id && run(() => completeChallenge(challenge.id as string))}
                    >
                      Mark as done
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={busy || challenge.rollsRemaining === 0}
                      aria-describedby={rollReason ? 'skip-reason' : undefined}
                      onClick={() => challenge.id && run(() => rollChallenge(challenge.id as string))}
                    >
                      Skip · {challenge.rollsRemaining} left
                    </button>
                  </div>
                )}
                {rollReason && (
                  <p id="skip-reason" className={styles.muted}>
                    {rollReason}
                  </p>
                )}
              </>
            ) : (
              // FR-1.7: a welcome that routes to import, never a blank card.
              <p className={styles.muted}>
                Nothing saved yet. Paste an article on the{' '}
                <Link href="/text#import" className={styles.inlineLink}>
                  text page
                </Link>{' '}
                and it becomes a two-minute action, waiting here each morning.
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
