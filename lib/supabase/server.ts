// The server client for route handlers and server components. Same anon key as
// the browser, same RLS scope: it acts AS the signed-in user, read from the
// session cookie. It never bypasses RLS — that is the service-role key's job,
// and that key is not imported here.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { supabaseAnonKey, supabaseUrl } from './env';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. That is fine: middleware.ts
          // refreshes the session on every request, so a refreshed token
          // dropped here is written there.
        }
      },
    },
  });
}
