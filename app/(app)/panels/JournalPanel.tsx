'use client';

// The notebook's panel — the Smart Journal in the room (build plan 3.4, F3).
//
// It is /text's journal body, not a second copy of it: the privacy copy, the
// mood and tags, the reflect control that only a direct activation triggers
// (AC-3.6), and the AI Insight block that cannot be mistaken for the user's
// own words (AC-3.3). One implementation keeps FR-3.6 true on both surfaces.
//
// The entry lives only in component state. Closing the panel unmounts it, and
// the words go with it.

import { JournalBody } from '../text/JournalSection';
import { Skeleton } from '../text/Skeleton';
import { useSurfaceState } from '../useSurfaceState';

export function JournalPanel() {
  const { ready, signedIn } = useSurfaceState();
  if (!ready) return <Skeleton />;
  return <JournalBody signedIn={signedIn} />;
}
