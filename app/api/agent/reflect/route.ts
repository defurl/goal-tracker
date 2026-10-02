// POST /api/agent/reflect — journal_analysis_agent (spec/04-ai-agents.md §3).
//
// ─────────────────────────────────────────────────────────────────────────
// DO NOT LOG THE REQUEST BODY. Not on error, not while debugging, not "just
// the length". The body is the user's journal entry, and FR-3.6 promises it
// is never persisted — a log line is persistence. The natural instinct when
// this route fails is to log its input; that one line breaks the product's
// central privacy promise. A failure shows up as its error code in
// agent_logs. That is all the debugging this route gets.
//
// The one line this route writes to the server log is a security event, when
// it refuses a request: a forged origin, the wrong content type, a body over
// the byte cap, the day's reflections spent. It records that the request was
// refused and who sent it — never the body, its length, the mood, the tags or
// the support flag. lib/security/securityLog.ts has no field that could hold
// them; keep it that way.
// ─────────────────────────────────────────────────────────────────────────
//
// Wiring only; the pipeline is lib/agents/reflect.ts. screen() and readJson()
// are the shared guard for cookie-authenticated writes: origin, content type,
// and the body's byte cap (lib/security/requestGuard.ts).

import { reflectOnEntry } from '../../../../lib/agents/reflect.ts';
import { aiReflectEnabled } from '../../../../lib/flags.ts';
import { GUARDED, readJson, screen } from '../../../../lib/security/requestGuard.ts';
import { logSecurityEvent } from '../../../../lib/security/securityLog.ts';
import { json, provider, serviceClient, signedInUser } from '../../_lib/server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ROUTE = GUARDED.reflect;

export async function POST(request: Request) {
  const refused = screen(request, ROUTE);
  if (refused) return refused;

  const caller = await signedInUser();
  if (!caller) return json({ error: 'signed_out' }, 401);

  const input = await readJson(request, ROUTE, caller.userId);
  if (!input.ok) return input.response;

  const result = await reflectOnEntry(
    {
      provider: provider(),
      db: caller.db,
      service: serviceClient(),
      userId: caller.userId,
      // Off by default: the free Gemini tier is no place for a journal entry.
      reflectionEnabled: aiReflectEnabled,
    },
    input.value,
  );

  // The outcome alone: the status, never the reflection or anything in it.
  if (result.status === 429) {
    logSecurityEvent(request, {
      event: 'ai.quota_exceeded',
      route: ROUTE.route,
      outcome: 'refused',
      status: 429,
      reason: 'daily_limit',
      userId: caller.userId,
    });
  }

  const headers: Record<string, string> =
    result.status === 429 ? { 'Retry-After': String(result.retryAfter) } : {};
  return json(result.body, result.status, headers);
}
