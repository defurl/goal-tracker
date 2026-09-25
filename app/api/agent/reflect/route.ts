// POST /api/agent/reflect — journal_analysis_agent (spec/04-ai-agents.md §3).
//
// ─────────────────────────────────────────────────────────────────────────
// DO NOT LOG THE REQUEST BODY. Not on error, not while debugging, not "just
// the length". The body is the user's journal entry, and FR-3.6 promises it
// is never persisted — a log line is persistence. The natural instinct when
// this route fails is to log its input; that one line breaks the product's
// central privacy promise. A failure shows up as its error code in
// agent_logs. That is all the debugging this route gets.
// ─────────────────────────────────────────────────────────────────────────
//
// Wiring only; the pipeline is lib/agents/reflect.ts.

import { reflectOnEntry } from '../../../../lib/agents/reflect.ts';
import { json, provider, readJson, serviceClient, signedInUser } from '../../_lib/server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  const caller = await signedInUser();
  if (!caller) return json({ error: 'signed_out' }, 401);

  const result = await reflectOnEntry(
    { provider: provider(), db: caller.db, service: serviceClient(), userId: caller.userId },
    await readJson(request),
  );

  const headers: Record<string, string> =
    result.status === 429 ? { 'Retry-After': String(result.retryAfter) } : {};
  return json(result.body, result.status, headers);
}
