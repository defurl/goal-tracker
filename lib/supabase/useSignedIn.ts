'use client';

// Whether someone is signed in, for DOM corner furniture only. The room never
// asks: it reads the store, which lib/data/ fills with the default room or the
// user's own (spec/05 §7), so no scene object needs to know who is there.

import { useEffect, useState } from 'react';

import { createClient } from './client';
import { supabaseConfigured } from './env';

/** null until known — callers render nothing rather than flash the wrong label. */
export function useSignedIn(): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    // A throw counts as signed out, never as "still unknown": callers wait on
    // null, so a null that never resolves would hold them forever.
    void supabase.auth
      .getUser()
      .then(({ data }) => setSignedIn(data.user !== null))
      .catch(() => setSignedIn(false));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(session !== null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return signedIn;
}
