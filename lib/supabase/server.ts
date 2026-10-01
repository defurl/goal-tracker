// The server client for route handlers and server components. Same anon key as
// the browser, same RLS scope: it acts AS the signed-in user, read from the
// session cookie. It never bypasses RLS — that is the service-role key's job,
// and that key is not imported here.
//
// Every cookie it writes goes through ./cookies: Secure when the request came
// over https, and the idle window instead of the library's 400 days.

import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';

import { isHttps, sessionCookieWrites } from './cookies';
import type { Database } from './database.types';
import { supabaseAnonKey, supabaseUrl } from './env';

export function createClient() {
  const cookieStore = cookies();
  // No request URL here. Vercel sets the header, and `next start` fills it in
  // from its own socket when nothing upstream did.
  const secure = isHttps({ forwardedProto: headers().get('x-forwarded-proto') });

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          const current = cookieStore.getAll();
          for (const { name, value, options } of sessionCookieWrites(cookiesToSet, current, { secure })) {
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
