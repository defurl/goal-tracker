'use client';

// Focus on /text — the headphones' two-minute timer, silent (A5.2, D-24 §6).
// /text has no sound (D-23 §10), so this is the timer alone: start it, watch
// it count, and it ends quietly — no chime, no alert, the count just goes.
//
// Leaving /text ends it, the way leaving the room ends the room's, so a timer
// started here never follows the user into the room and turns into sound.
//
// Signed out too: focus is not stored, so it needs no account.

import { useEffect } from 'react';

import { setFocusMode, toggleFocusMode } from '../../../lib/data/focus';
import { useAppStore } from '../../../lib/stores/app';
import { useFocusCountdown } from '../useFocusCountdown';

import styles from './text.module.css';

export function FocusSection() {
  const on = useAppStore((s) => s.focusMode);
  const remaining = useFocusCountdown();

  useEffect(() => () => setFocusMode(false), []);

  return (
    <section className={styles.section} aria-labelledby="focus-heading">
      <h2 id="focus-heading" className={styles.heading}>Focus</h2>
      <p className={styles.quiet}>Two minutes on one thing. It ends on its own, without a sound.</p>
      <div className={styles.row}>
        <button type="button" className={styles.action} aria-pressed={on} onClick={toggleFocusMode}>
          {on ? 'stop' : 'start two minutes'}
        </button>
        {remaining && (
          <span className={styles.label} role="timer" aria-label={`focus: ${remaining} left`}>
            <span className={styles.number}>{remaining}</span> left
          </span>
        )}
      </div>
    </section>
  );
}
