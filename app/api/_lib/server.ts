// Server-only wiring shared by the agent routes. The one place the two secret
// keys are read — API-1: "read only inside app/api/". The `_lib` folder is
// private to the App Router, so nothing here is routable.
//
// Never import this from a client component, lib/, or scene/. A key reachable
// from the browser bundle is a shipped credential leak.

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import { OpenAIProvider } from '../../../lib/agents/openai.ts';
import type { Database } from '../../../lib/supabase/database.types.ts';
import { supabaseUrl } from '../../../lib/supabase/env.ts';
import { createClient as createUserClient } from '../../../lib/supabase/server.ts';

if (typeof window !== 'undefined') {
  throw new Error('app/api/_lib/server.ts was bundled for the browser.');
}

/** Bypasses RLS. For rate_limits and agent_logs, which have no user write path. */
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createSupabaseClient<Database>(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** No key means every call fails fast to PROVIDER_ERROR, and the fallback ships. */
export function provider() {
  return new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY ?? '' });
}

/** The caller's own client and verified id, or null when signed out. */
export async function signedInUser() {
  const db = createUserClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user ? { db, userId: user.id } : null;
}

/** JSON, or undefined for a body that is not — never echoed back or logged. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
