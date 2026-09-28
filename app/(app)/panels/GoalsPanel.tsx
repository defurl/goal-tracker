'use client';

// Monitor 2's panel — the Goal Dashboard in the room (build plan 3.3, F4).
//
// The screen carries a summary; the SVG timeline, the milestones and a new
// goal live here (AC-4.5). It is /text's goals body, not a second copy of it,
// so the two surfaces cannot drift apart (D-07).

import { supabaseConfigured } from '../../../lib/supabase/env';
import { useSignedIn } from '../../../lib/supabase/useSignedIn';
import { GoalsBody } from '../text/GoalsSection';

export function GoalsPanel() {
  const signedIn = useSignedIn();
  return <GoalsBody signedIn={supabaseConfigured && signedIn === true} />;
}
