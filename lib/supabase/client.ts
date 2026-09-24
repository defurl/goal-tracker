// The browser client — the anon key plus the user's session cookie, so every
// query it makes is RLS-scoped to that user and nobody else.
//
// One instance per tab: createBrowserClient memoises, and a second client would
// run a second token-refresh timer against the same session.

import { createBrowserClient } from '@supabase/ssr';

import type { Database } from './database.types';
import { supabaseAnonKey, supabaseUrl } from './env';

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
