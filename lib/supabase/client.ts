// The browser client — the anon key plus the user's session cookie, so every
// query it makes is RLS-scoped to that user and nobody else.
//
// One instance per tab: createBrowserClient memoises, and a second client would
// run a second token-refresh timer against the same session.
//
// The cookie methods are the library's own document.cookie fallback with one
// change: every write goes through ./cookies, for Secure on https and the idle
// window the library would otherwise overwrite with 400 days.

import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';

import { isHttps, sessionCookieWrites } from './cookies';
import type { Database } from './database.types';
import { supabaseAnonKey, supabaseUrl } from './env';

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // Only a prerender has no document; it has no session either.
        return typeof document === 'undefined' ? [] : parseCookieHeader(document.cookie);
      },
      setAll(cookiesToSet) {
        const secure = isHttps({ protocol: window.location.protocol });
        const current = parseCookieHeader(document.cookie);
        for (const { name, value, options } of sessionCookieWrites(cookiesToSet, current, { secure })) {
          document.cookie = serializeCookieHeader(name, value, options);
        }
      },
    },
  });
}
