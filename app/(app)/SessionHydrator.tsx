'use client';

// Loads the store once and keeps it in step with sign-in and sign-out. Renders
// nothing: the room and /text read the store, never this component.

import { useEffect } from 'react';

import { watchClock } from '@/lib/data/clock';
import { hydrate, watchSession } from '@/lib/data/hydrate';

export function SessionHydrator() {
  useEffect(() => {
    void hydrate();
    const stopSession = watchSession();
    // The window follows the clock while the room is open (spec/05 §5).
    const stopClock = watchClock();
    return () => {
      stopSession();
      stopClock();
    };
  }, []);
  return null;
}
