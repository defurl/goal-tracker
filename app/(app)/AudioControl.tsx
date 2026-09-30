'use client';

// The audio toggle — bottom-right global control (design-system/08 §5, §7).
//
// Sound is OFF on every visit and starts only from a click: here, or on the
// headphones in the room, which flip the same `focusMode` (08 §4). This
// component also owns the bed itself, following `focusMode` whichever control
// flipped it, so there is exactly one place that makes sound.
//
// Leaving the room (to /text, say) fades the bed out and turns focus mode off,
// so the store never claims sound that is not playing. /text's silent timer
// does the same on its way out (FocusSection), and the bed follows the live
// store rather than the value this render saw, so arriving from a /text timer
// never starts the sound on its own.
//
// While focus is on, its two-minute countdown sits beside the button (A5.2).

import { useEffect } from 'react';

import { setAmbient } from '../../lib/audio/ambient';
import { setFocusMode, toggleFocusMode } from '../../lib/data/focus';
import { useAppStore } from '../../lib/stores/app';
import styles from './AudioControl.module.css';
import { useFocusCountdown } from './useFocusCountdown';

export function AudioControl() {
  const on = useAppStore((s) => s.focusMode);
  const remaining = useFocusCountdown();

  useEffect(() => {
    void setAmbient(useAppStore.getState().focusMode);
  }, [on]);

  useEffect(
    () => () => {
      setFocusMode(false);
      void setAmbient(false);
    },
    [],
  );

  return (
    <div className={styles.corner}>
      {remaining && (
        <span className={styles.count} role="timer" aria-label={`focus: ${remaining} left`}>
          {remaining}
        </span>
      )}
      <button type="button" className={styles.control} aria-pressed={on} onClick={toggleFocusMode}>
        {on ? 'sound on' : 'sound off'}
      </button>
    </div>
  );
}
