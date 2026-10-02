// Sign out (B1.1). POST only, so a prefetch or a stray <img src> cannot end
// someone's session — and screen() refuses a post from another origin, or one
// that names none (lib/security/requestGuard.ts), so a page elsewhere cannot.
//
// One security event records the sign-out: the outcome, the verified user id
// (null when nobody was signed in), the address and browser.

import { NextResponse, type NextRequest } from 'next/server';

import { GUARDED, screen } from '@/lib/security/requestGuard';
import { logSecurityEvent } from '@/lib/security/securityLog';
import { createClient } from '@/lib/supabase/server';

// Two auth calls. A ceiling well under the platform's 300 s default.
export const maxDuration = 30;

const ROUTE = GUARDED.signOut;

export async function POST(request: NextRequest) {
  const refused = screen(request, ROUTE);
  if (refused) return refused;

  const db = createClient();
  const userId = (await db.auth.getUser().catch(() => null))?.data.user?.id ?? null;
  // On a failed revoke signOut() still clears the session cookies, and says so.
  const signedOut = await db.auth.signOut().then(
    ({ error }) => error === null,
    () => false,
  );
  logSecurityEvent(request, {
    event: 'auth.sign_out',
    route: ROUTE.route,
    outcome: signedOut ? 'succeeded' : 'failed',
    status: 303,
    userId,
  });
  return NextResponse.redirect(`${request.nextUrl.origin}/login`, { status: 303 });
}
