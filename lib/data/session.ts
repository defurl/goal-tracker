// Who the data layer is acting for. hydrate() sets it on sign-in and clears it
// on sign-out, so every loader and mutation after that asks the same client,
// for the same user, about the same local day.

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../supabase/database.types';
import { localDate } from './time';

export interface DataSession {
  supabase: SupabaseClient<Database>;
  userId: string;
  timeZone: string;
}

let current: DataSession | null = null;

export function setSession(session: DataSession | null): void {
  current = session;
}

/** Null when signed out: mutations are then no-ops and the UI says why. */
export function getSession(): DataSession | null {
  return current;
}

export function today(session: DataSession): string {
  return localDate(session.timeZone);
}

export { shiftDate, weekday } from '../dates';
