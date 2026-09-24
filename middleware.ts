// SSR session handling (B1.1). Refreshes the Supabase session cookie on every
// page request so server code never sees an expired token, and so the browser
// and the server agree on who is signed in.
//
// It does NOT gate routes. Whether a signed-out visitor sees the room or is
// sent to /login is not decided in the spec, and spec/05 §7 argues the room is
// a place that renders fully either way — so the answer is left to the owner
// rather than guessed here.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from './lib/supabase/env';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  // No backend configured (a fresh checkout, CI's capture job): serve the room.
  if (!supabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser(), not getSession(): it revalidates the token with the auth server
  // instead of trusting whatever the cookie claims. Nothing may run between
  // creating the client and this call, or a refresh can be lost.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Pages and route handlers only — not build assets, fonts or images, which
  // carry no session and would each pay a round trip to the auth server.
  matcher: ['/((?!_next/static|_next/image|fonts/|favicon.ico|.*\\.(?:png|jpg|svg|webp|woff2)$).*)'],
};
