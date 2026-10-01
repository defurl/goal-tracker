// Sign out (B1.1). POST only, so a prefetch or a stray <img src> cannot end
// someone's session — and screen() refuses a post from another origin, or one
// that names none (lib/security/requestGuard.ts), so a page elsewhere cannot.

import { NextResponse, type NextRequest } from 'next/server';

import { GUARDED, screen } from '@/lib/security/requestGuard';
import { createClient } from '@/lib/supabase/server';

const ROUTE = GUARDED.signOut;

export async function POST(request: NextRequest) {
  const refused = screen(request, ROUTE);
  if (refused) return refused;

  await createClient().auth.signOut();
  return NextResponse.redirect(`${request.nextUrl.origin}/login`, { status: 303 });
}
