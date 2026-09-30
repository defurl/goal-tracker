// The two operational writes every agent route makes, through the service role:
//
//   RATE-1   consume_rate_limit() — increment-and-check in one statement (017)
//   LOG-1    one agent_logs row per call, success or failure
//
// agent_logs takes token counts, latency and a CODE. There is no parameter
// here that could carry input or output text, and that is the point: the row
// type below is the whole of what can be logged.

import type { SupabaseClient } from '@supabase/supabase-js';

import { secondsIntoLocalDay } from '../data/time.ts';
import { DAILY_LIMITS, planOf, type AgentId } from '../prompts/index.ts';
import type { Database } from '../supabase/database.types.ts';
import type { AgentErrorCode } from './provider.ts';

type Db = SupabaseClient<Database>;

/**
 * The provider's codes (04 §3), plus the extraction agent's own: the article
 * could not be read, so the model was never called. Also a code, never a
 * message — a fetch error can name the URL.
 */
export type LoggedErrorCode = AgentErrorCode | 'SOURCE_UNREADABLE' | 'LIMITER_UNAVAILABLE' | 'QUOTED_ENTRY';

export interface AgentLogRow {
  agentId: string;
  userId: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  success: boolean;
  errorCode: LoggedErrorCode | null;
}

export type RateDecision = { allowed: true } | { allowed: false; unavailable: boolean };

/**
 * Counts this request and says whether it is within the cap. If the counter
 * cannot be reached the provider is not called — an outage in the rate
 * limiter must not become unmetered spend — but that is `unavailable`, not
 * "over the limit": the caller serves a curated fallback rather than telling
 * the user they have used up a day they have not.
 */
export async function consumeRateLimit(
  service: Db,
  userId: string,
  agentId: AgentId,
  date: string,
): Promise<RateDecision> {
  const [count, cap] = await Promise.all([
    service.rpc('consume_rate_limit', { p_user_id: userId, p_agent_id: agentId, p_date: date }),
    dailyLimit(service, userId, agentId),
  ]);
  const { data, error } = count;
  if (error || typeof data !== 'number') return { allowed: false, unavailable: true };
  return data <= cap ? { allowed: true } : { allowed: false, unavailable: false };
}

/**
 * The cap on the caller's plan (025, D-24 §7). A plan that cannot be read is
 * taken as 'free': the lowest caps, so a failed read never grants more.
 */
export async function dailyLimit(service: Db, userId: string, agentId: AgentId): Promise<number> {
  const { data } = await service.from('user_plans').select('plan').eq('user_id', userId).maybeSingle();
  return DAILY_LIMITS[planOf(data?.plan)][agentId];
}

/** Seconds until the user's next local midnight, when their count resets. */
export function retryAfterSeconds(timeZone: string, now: Date = new Date()): number {
  return Math.max(1, 86400 - secondsIntoLocalDay(timeZone, now));
}

/** LOG-1. A failed log write never fails the user's request. */
export async function logAgentCall(service: Db, row: AgentLogRow): Promise<void> {
  await service
    .from('agent_logs')
    .insert({
      agent_id: row.agentId,
      user_id: row.userId,
      model: row.model,
      input_tokens: row.inputTokens,
      output_tokens: row.outputTokens,
      latency_ms: row.latencyMs,
      success: row.success,
      error_code: row.errorCode,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}
