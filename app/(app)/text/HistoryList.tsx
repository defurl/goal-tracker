'use client';

// Every habit's year in words — the history panel in the hall and the history
// section on /text (design-system/13 §8, A5.9). A list, not cards (D-04).
//
// Longest streak first, the current one beside it, and the days kept this year
// (D-09: the longest is the primary number; a reset is never announced). An
// archived habit keeps its history and says it is archived; it has no "now".
// Nothing here counts a miss (D-08).
//
// On /text, which has no wall, each habit also gets its last twelve weeks as a
// strip under its line — the only picture of the days that surface has.

import { useEffect } from 'react';

import type { HistoryRow } from '../../../lib/history';
import { ensureHistory } from '../../../lib/data/history';
import { useAppStore } from '../../../lib/stores/app';
import { Skeleton } from './Skeleton';
import styles from './text.module.css';

/** Twelve weeks, a week to a column, today last (design-system/13 §8). */
const STRIP_DAYS = 12 * 7;

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/**
 * The strip: kept or not, nothing else — a day not kept is an empty cell, the
 * same as a day the habit was not due (D-08). Every seventh day shares a row,
 * so a weekly rhythm reads across it. One image to a screen reader, not 84.
 *
 * Twelve weeks with nothing kept draw nothing: 84 empty cells would be a row
 * of zeros (X-1) — for a habit archived months ago, or one begun today.
 */
function Strip({ row }: { row: HistoryRow }) {
  const recent = row.days.slice(-STRIP_DAYS);
  const kept = recent.filter((d) => d > 0).length;
  if (kept === 0) return null;
  return (
    <div
      className={`${styles.calendar} ${styles.strip}`}
      role="img"
      aria-label={`${row.name}, the last twelve weeks: kept ${days(kept)}`}
    >
      {recent.map((d, i) => (
        <span key={i} className={d > 0 ? `${styles.day} ${styles.dayWarm}` : styles.day} />
      ))}
    </div>
  );
}

export function HistoryList({
  ready,
  signedIn,
  surface,
}: {
  ready: boolean;
  signedIn: boolean;
  /** The hall's panel sits beside the wall; /text has only this list. */
  surface: 'hall' | 'text';
}) {
  const history = useAppStore((s) => s.history);

  useEffect(() => {
    if (ready) void ensureHistory();
  }, [ready]);

  if (!ready || (signedIn && history === null)) return <Skeleton />;

  if (!signedIn || !history || history.length === 0) {
    // X-1: a welcome, not a row of zeros.
    const where = surface === 'hall' ? 'Your kept days will line this wall.' : 'Your kept days will gather here.';
    const how =
      surface === 'hall'
        ? 'Add a habit and keep it — each day you do becomes a light in the concrete.'
        : 'Add a habit and keep it — each day you do is marked under its name.';
    return <p className={styles.quiet}>{signedIn ? `${where} ${how}` : `${where} Sign in and add a habit to begin.`}</p>;
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
            {surface === 'text' && <Strip row={row} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
