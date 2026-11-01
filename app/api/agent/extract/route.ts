// POST /api/agent/extract — content_extraction_agent (spec/04-ai-agents.md §2).
// Wiring only; the pipeline is lib/agents/extract.ts. screen() and readJson()
// are the shared guard for cookie-authenticated writes: origin, content type,
// and the body's byte cap (lib/security/requestGuard.ts).

import { draftFromSource, extractAction } from '../../../../lib/agents/extract.ts';
import { GUARDED, readJson, screen } from '../../../../lib/security/requestGuard.ts';
import { logSecurityEvent } from '../../../../lib/security/securityLog.ts';
import { json, provider, serviceClient, signedInUser } from '../../_lib/server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 8 s article fetch + two model attempts. Vercel's default would cut it short.
export const maxDuration = 30;

const ROUTE = GUARDED.extract;

export async function POST(request: Request) {
  const refused = screen(request, ROUTE);
  if (refused) return refused;

  const caller = await signedInUser();
  if (!caller) return json({ error: 'signed_out' }, 401);

  const input = await readJson(request, ROUTE, caller.userId);
  if (!input.ok) return input.response;

  // `draft: true` asks for a draft to approve, saved nowhere (D-26 §8).
  const deps = { provider: provider(), db: caller.db, service: serviceClient(), userId: caller.userId };
  const wantsDraft = (input.value as { draft?: unknown } | null)?.draft === true;
  const result = wantsDraft ? await draftFromSource(deps, input.value) : await extractAction(deps, input.value);

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
