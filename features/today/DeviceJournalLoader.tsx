'use client';

// Loads the journal kept on this device for whoever is signed in, and again
// when that changes, so Today's mood and energy show the right account's
// check-in. Renders nothing.

import { useEffect } from 'react';

import { useSurfaceState } from '@/app/(app)/useSurfaceState';
import { loadDeviceJournal } from '@/lib/journal/device';

export function DeviceJournalLoader() {
  const { ready, signedIn } = useSurfaceState();
  useEffect(() => {
    if (ready) void loadDeviceJournal();
  }, [ready, signedIn]);
  return null;
}
