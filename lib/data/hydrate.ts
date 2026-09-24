// First load (spec/05 §7). Until it completes, `hydrated` is false and the room
// renders fully lit with empty state — a new user and a loading user see the
// same room. The only difference is what arrives in it.
//
// Phase 1 skeleton: the profile clock and points. Challenge, habits, journal and
// goals each join this with their feature, in the same phase for both surfaces
// (D-07).

import { createClient } from '../supabase/client';
import { supabaseConfigured } from '../supabase/env';
import { loadPoints } from './points';
import { localDate, localHour } from './time';
import { write } from './write';

export async function hydrate(): Promise<void> {
  // No backend, or nobody signed in: the empty room is the correct state, and
  // it is already in the store. Mark it hydrated so nothing waits on it.
  if (!supabaseConfigured) {
    write({ hydrated: true });
    return;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    write({ hydrated: true });
    return;
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .single();
    if (error) throw error;

    const timeZone: string = profile.timezone;
    const points = await loadPoints(supabase, user.id, localDate(timeZone));

    write({ points, localHour: localHour(timeZone), hydrated: true, offline: false });
  } catch {
    // A failed load leaves the last known state standing. No error surface in
    // the room — the corner furniture shows offline (spec/05 §7).
    write({ hydrated: true, offline: typeof navigator !== 'undefined' && !navigator.onLine });
  }
}
