// GET /api/cron/seed-challenges — challenge_generator_agent (spec/04 §4).
//
// The hourly schedule lives in the database (018, pg_cron — owner decision
// 2026-09-25). This route runs the same run_challenge_sweep() on demand, and
// keeps the name and the route a smarter selector will one day replace.
//
// Guarded by CRON_SECRET as a bearer token, so it cannot be triggered by
// anyone who finds the URL. No secret configured → nothing can call it.

import { timingSafeEqual } from 'node:crypto';

import { json, serviceClient } from '../../_lib/server.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? '';
  if (!secret) return false;
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorised(request)) return json({ error: 'unauthorised' }, 401);

  const { data, error } = await serviceClient().rpc('run_challenge_sweep');
  if (error) return json({ error: 'sweep_failed' }, 500);
  return json({ seeded: data });
}
