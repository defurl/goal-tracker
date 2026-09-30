'use client';

// The focus timer's countdown, for the DOM that shows it: the corner beside the
// sound control in the room, and the focus section on /text (A5.2).
//
// The store holds only the end time. The ticking is local to whoever renders
// the count — once a second, and only while a timer runs — so no per-second
// value ever reaches the store, and the scene never re-renders for it
// (spec/05 §1). Under reduced motion the number still changes; nothing moves.

import { useEffect, useState } from 'react';

import { formatRemaining } from '../../lib/focusTimer';
import { useAppStore } from '../../lib/stores/app';

/** "m:ss" left while focus is on, else null. */
export function useFocusCountdown(): string | null {
  const endsAt = useAppStore((s) => s.focusEndsAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return endsAt === null ? null : formatRemaining(endsAt, now);
}
