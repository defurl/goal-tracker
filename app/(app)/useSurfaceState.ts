'use client';

// Whether /text or a panel knows enough to render its real content yet.
//
// Two things arrive after first paint: the store's first load (`hydrated`) and
// who is signed in (`useSignedIn`, null until known). Rendering before both
// shows the wrong thing for a moment — "No habits yet" to a user who has
// habits, "sign in" to a user who is signed in. Until `ready`, callers show the
// skeleton instead (X-1, X-2).

import { useAppStore } from '../../lib/stores/app';
import { supabaseConfigured } from '../../lib/supabase/env';
import { useSignedIn } from '../../lib/supabase/useSignedIn';

export function useSurfaceState(): { ready: boolean; signedIn: boolean } {
  const signedInState = useSignedIn();
  const hydrated = useAppStore((s) => s.hydrated);
  // With no backend configured nobody can sign in, so there is nothing to wait for.
  const authKnown = !supabaseConfigured || signedInState !== null;
  return {
    ready: hydrated && authKnown,
    signedIn: supabaseConfigured && signedInState === true,
  };
}
