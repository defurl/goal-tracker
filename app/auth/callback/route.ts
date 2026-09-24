// Where Google OAuth and email confirmation land (B1.1). Exchanges the one-time
// code for a session cookie, then sends the user on.
//
// `next` is honoured only as a same-origin path. An absolute URL there would
// make this an open redirect: a link to our own domain that forwards a freshly
// signed-in user anywhere.

import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const { error } = await createClient().auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // A stale or reused link. Back to sign-in with a plain notice — no error page.
  return NextResponse.redirect(`${origin}/login?link=expired`);
}
