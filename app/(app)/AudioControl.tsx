'use client';

// The audio toggle — bottom-right global control (design-system/08 §5, §7).
//
// Sound is OFF on every visit and starts only from a click: here, or on the
// headphones in the room, which flip the same `focusMode` (08 §4). This
// component also owns the bed itself, following `focusMode` whichever control
// flipped it, so there is exactly one place that makes sound.
//
// Leaving the room (to /text, say) fades the bed out and turns focus mode off,
// so the store never claims sound that is not playing.

import { useEffect } from 'react';

import { setAmbient } from '../../lib/audio/ambient';
import { setFocusMode, toggleFocusMode } from '../../lib/data/focus';
import { useAppStore } from '../../lib/stores/app';
import styles from './AudioControl.module.css';

export function AudioControl() {
  const on = useAppStore((s) => s.focusMode);

  useEffect(() => {
    void setAmbient(on);
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
      <button type="button" className={styles.control} aria-pressed={on} onClick={toggleFocusMode}>
        {on ? 'sound on' : 'sound off'}
      </button>
    </div>
  );
}
