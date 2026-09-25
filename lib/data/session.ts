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

/** YYYY-MM-DD, `days` before (negative) or after `date`. Calendar arithmetic, no zone. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday — Postgres' extract(dow), which habits.frequency uses (020). */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
