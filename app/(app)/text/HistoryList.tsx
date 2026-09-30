'use client';

// Every habit's year in words — the history panel in the hall and, in A5.9, the
// history section on /text (design-system/13 §8). A list, not cards (D-04).
//
// Longest streak first, the current one beside it, and the days kept this year
// (D-09: the longest is the primary number; a reset is never announced). An
// archived habit keeps its history and says it is archived; it has no "now".
// Nothing here counts a miss (D-08).

import { useEffect } from 'react';

import { ensureHistory } from '../../../lib/data/history';
import { useAppStore } from '../../../lib/stores/app';
import { Skeleton } from './Skeleton';
import styles from './text.module.css';

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

export function HistoryList({ ready, signedIn }: { ready: boolean; signedIn: boolean }) {
  const history = useAppStore((s) => s.history);

  useEffect(() => {
    if (ready) void ensureHistory();
  }, [ready]);

  if (!ready || (signedIn && history === null)) return <Skeleton />;

  if (!signedIn || !history || history.length === 0) {
    // X-1: a welcome, not a row of zeros.
    return (
      <p className={styles.quiet}>
        {signedIn
          ? 'Your kept days will line this wall. Add a habit and keep it — each day you do becomes a light in the concrete.'
          : 'Your kept days will line this wall. Sign in and add a habit to begin.'}
      </p>
    );
  }

  return (
    <ul className={`${styles.list} ${styles.sentences}`}>
      {history.map((row) => (
        <li key={row.id} className={styles.item}>
          <div className={styles.itemBody}>
            <span className={styles.prose}>{row.name}</span>
            <span className={styles.label}>
              longest <span className={styles.number}>{days(row.longestStreak)}</span>
              {row.archived ? ' · archived' : <> · now {days(row.currentStreak)}</>}
              {' · '}kept {days(row.keptThisYear)} this year
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
