// POST /api/agent/extract — content_extraction_agent (spec/04-ai-agents.md §2).
// Wiring only; the pipeline is lib/agents/extract.ts. screen() and readJson()
// are the shared guard for cookie-authenticated writes: origin, content type,
// and the body's byte cap (lib/security/requestGuard.ts).

import { extractAction } from '../../../../lib/agents/extract.ts';
import { GUARDED, readJson, screen } from '../../../../lib/security/requestGuard.ts';
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

  const input = await readJson(request, ROUTE);
  if (!input.ok) return input.response;

  const result = await extractAction(
    { provider: provider(), db: caller.db, service: serviceClient(), userId: caller.userId },
    input.value,
  );

  const headers: Record<string, string> =
    result.status === 429 ? { 'Retry-After': String(result.retryAfter) } : {};
  return json(result.body, result.status, headers);
}
