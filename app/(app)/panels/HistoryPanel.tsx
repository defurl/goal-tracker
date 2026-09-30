'use client';

// The history wall's panel, in the hall (design-system/13 §8). The wall is
// texture at rest; this is where its numbers are legible.

import { HistoryList } from '../text/HistoryList';
import { useSurfaceState } from '../useSurfaceState';

export function HistoryPanel() {
  const { ready, signedIn } = useSurfaceState();
  return <HistoryList ready={ready} signedIn={signedIn} />;
}
