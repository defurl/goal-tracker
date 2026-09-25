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
import type { Database } from '../supabase/database.types.ts';
import type { AgentErrorCode } from './provider.ts';

type Db = SupabaseClient<Database>;

/**
 * The provider's codes (04 §3), plus the extraction agent's own: the article
 * could not be read, so the model was never called. Also a code, never a
 * message — a fetch error can name the URL.
 */
export type LoggedErrorCode = AgentErrorCode | 'SOURCE_UNREADABLE';

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

export type RateDecision = { allowed: true } | { allowed: false };

/**
 * Counts this request and says whether it is within the cap. If the counter
 * cannot be reached the request is refused, not waved through: an outage in
 * the rate limiter must not become unmetered provider spend.
 */
export async function consumeRateLimit(
  service: Db,
  userId: string,
  agentId: string,
  date: string,
  cap: number,
): Promise<RateDecision> {
  const { data, error } = await service.rpc('consume_rate_limit', {
    p_user_id: userId,
    p_agent_id: agentId,
    p_date: date,
  });
  if (error || typeof data !== 'number') return { allowed: false };
  return data <= cap ? { allowed: true } : { allowed: false };
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
