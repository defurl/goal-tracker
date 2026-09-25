// First load, and every sign-in and sign-out after it (spec/05 §7).
//
// Owner decision 2026-09-24: `/` is never gated. Signed out, the store holds
// the default room — initialAppState, exactly what a new user sees. Signed in,
// that user's own data is loaded into the same room. Until the first load
// completes `hydrated` is false and the room renders fully lit and empty, so a
// new user, a loading user and a signed-out visitor all see the same place.
//
// Every feature's slice loads here, in the same phase for both surfaces (D-07):
// the profile clock, points, the challenge, habits and the day grid, the
// journal, and goals.

import type { SupabaseClient } from '@supabase/supabase-js';

import { initialAppState } from '../stores/app';
import { createClient } from '../supabase/client';
import type { Database } from '../supabase/database.types';
import { supabaseConfigured } from '../supabase/env';
import { loadChallenge } from './challenge';
import { loadHabits } from './habits';
import { loadPoints } from './points';
import { setSession } from './session';
import { localDate, localHour } from './time';
import { write } from './write';

function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** The default room. The window still follows the visitor's real clock. */
function writeDefaultRoom(): void {
  setSession(null);
  write({ ...initialAppState, localHour: localHour(browserTimeZone()), hydrated: true });
}

/**
 * The profile row starts at UTC (handle_new_user). The first time a signed-in
 * browser sees that default, it records the browser's zone, so the seeder's
 * "local midnight" is the user's midnight. PROPOSED — a zone the user set
 * deliberately is never overwritten, because only the untouched default is.
 */
async function resolveTimeZone(
  supabase: SupabaseClient<Database>,
  userId: string,
  stored: string,
): Promise<string> {
  const browser = browserTimeZone();
  if (stored !== 'UTC' || browser === 'UTC') return stored;
  const { error } = await supabase.from('profiles').update({ timezone: browser }).eq('id', userId);
  return error ? stored : browser;
}

export async function hydrate(): Promise<void> {
  if (!supabaseConfigured) {
    writeDefaultRoom();
    return;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    writeDefaultRoom();
    return;
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', user.id)
      .single();
    if (error) throw error;

    const timeZone = await resolveTimeZone(supabase, user.id, profile.timezone);
    const session = { supabase, userId: user.id, timeZone };
    setSession(session);

    const [points, challenge, habits] = await Promise.all([
      loadPoints(supabase, user.id, localDate(timeZone)),
      loadChallenge(session),
      loadHabits(session),
    ]);

    // From initialAppState, not a merge: nothing of a previous session's user
    // may survive into this one's room.
    write({
      ...initialAppState,
      points,
      challenge,
      ...habits,
      localHour: localHour(timeZone),
      hydrated: true,
      offline: false,
    });
  } catch {
    // A failed load leaves the last known state standing. No error surface in
    // the room — the corner furniture shows offline (spec/05 §7).
    write({ hydrated: true, offline: typeof navigator !== 'undefined' && !navigator.onLine });
  }
}

/**
 * Re-hydrates on sign-in and sign-out, so the room swaps between the default
 * and the user's own without a reload. Returns the unsubscribe.
 */
export function watchSession(): () => void {
  if (!supabaseConfigured) return () => {};
  const { data } = createClient().auth.onAuthStateChange((event) => {
    // INITIAL_SESSION is covered by the first hydrate(); TOKEN_REFRESHED
    // changes nothing the room shows.
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      void hydrate();
    }
  });
  return () => data.subscription.unsubscribe();
}
