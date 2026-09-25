// POST /api/agent/extract — content_extraction_agent (spec/04-ai-agents.md §2).
// Wiring only; the pipeline is lib/agents/extract.ts.

import { extractAction } from '../../../../lib/agents/extract.ts';
import { json, provider, readJson, serviceClient, signedInUser } from '../../_lib/server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 8 s article fetch + two model attempts. Vercel's default would cut it short.
export const maxDuration = 30;

export async function POST(request: Request) {
  const caller = await signedInUser();
  if (!caller) return json({ error: 'signed_out' }, 401);

  const result = await extractAction(
    { provider: provider(), db: caller.db, service: serviceClient(), userId: caller.userId },
    await readJson(request),
  );

  const headers: Record<string, string> =
    result.status === 429 ? { 'Retry-After': String(result.retryAfter) } : {};
  return json(result.body, result.status, headers);
}
