'use client';

// Loads the store once and keeps it in step with sign-in and sign-out. Renders
// nothing: the room and /text read the store, never this component.

import { useEffect } from 'react';

import { hydrate, watchSession } from '@/lib/data/hydrate';

export function SessionHydrator() {
  useEffect(() => {
    void hydrate();
    return watchSession();
  }, []);
  return null;
}
