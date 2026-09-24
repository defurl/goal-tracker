// Sign out (B1.1). POST only, so a prefetch or a stray <img src> cannot end
// someone's session.

import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  await createClient().auth.signOut();
  return NextResponse.redirect(`${request.nextUrl.origin}/login`, { status: 303 });
}
