// SSR session handling (B1.1). Refreshes the Supabase session cookie on every
// page request so server code never sees an expired token, and so the browser
// and the server agree on who is signed in.
//
// It does NOT gate on sign-in: a signed-out visitor gets the default room
// (owner decision 2026-09-24, spec/05 §7).
//
// It does send phones from / to /text (D-07: "Mobile users land on /text by
// default with a discoverable way into the room" — owner decision 2026-09-25
// to ship it now). The way in is /text's "enter the room" link to /?room=1,
// which sets a cookie that stops the redirect for that browser from then on.

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from './lib/supabase/env';

const ROOM_COOKIE = 'bbe_room';

/** A phone, by its own client hint or, failing that, its user agent. Tablets keep the room. */
function isPhone(request: NextRequest): boolean {
  const hint = request.headers.get('sec-ch-ua-mobile');
  if (hint) return hint === '?1';
  return /iPhone|iPod|Android.*Mobile|Mobile.*Firefox|Windows Phone/i.test(request.headers.get('user-agent') ?? '');
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const choseRoom = pathname === '/' && searchParams.get('room') === '1';

  if (pathname === '/' && !choseRoom && !request.cookies.has(ROOM_COOKIE) && isPhone(request)) {
    return NextResponse.redirect(new URL('/text', request.url));
  }

  let response = NextResponse.next({ request });

  // No backend configured (a fresh checkout, CI's capture job): serve the room.
  if (supabaseConfigured) {
    response = await refreshSession(request, response);
  }

  // Set last: refreshSession() may replace the response object.
  if (choseRoom) {
    response.cookies.set(ROOM_COOKIE, '1', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }
  return response;
}

async function refreshSession(request: NextRequest, initial: NextResponse): Promise<NextResponse> {
  let response = initial;
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
