// content_extraction_agent, end to end — spec/04-ai-agents.md §1 and §2.
//
//   1. the caller has verified the session → userId
//   2. rate limit, 20 / user / local day  → 429, no provider call
//   3. validate input
//   4. URL → guarded fetch → Readability → 6000 chars;  text → 6000 chars
//   5–6. provider, JSON mode, schema + 40-word rule, retry once
//   7. store the action — the model's, or a curated fallback (FALLBACK-1)
//   8. one agent_logs row: tokens, latency, a code; never the text
//
// Dependencies are passed in so the route stays wiring, and so the gate test
// can run this with the provider's network blocked.

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { localDate } from '../data/time.ts';
import { withinWordLimit } from '../prompts/contentExtraction.ts';
import { FALLBACK_SOURCE_SUMMARY, pickFallbackAction } from '../prompts/fallbacks.ts';
import { AGENTS } from '../prompts/index.ts';
import type { Database } from '../supabase/database.types.ts';
import { fetchPage as guardedFetch } from './fetchPage.ts';
import { consumeRateLimit, logAgentCall, retryAfterSeconds, type LoggedErrorCode } from './ops.ts';
import type { AgentProvider } from './provider.ts';
import { capSource, readableText } from './readable.ts';
import { runAgent, type AgentRun } from './run.ts';

type Db = SupabaseClient<Database>;

const AGENT_ID = 'content_extraction_agent';
const { prompt, dailyLimit } = AGENTS[AGENT_ID];

export interface ExtractDeps {
  provider: AgentProvider;
  /** The signed-in user's own client. user_actions is written through RLS. */
  db: Db;
  /** Service role, for rate_limits and agent_logs only. */
  service: Db;
  userId: string;
  fetchPage?: (url: string) => Promise<{ html: string }>;
}

/** Pasted text beyond the cap is truncated after validation, not refused. */
export const ExtractInput = z
  .object({
    url: z.string().trim().min(1).max(2048).optional(),
    text: z.string().trim().min(1).max(50_000).optional(),
  })
  .refine((v) => Boolean(v.url) !== Boolean(v.text), 'exactly one of url or text');

export interface ActionView {
  id: string;
  actionText: string;
  sourceSummary: string;
  sourceUrl: string | null;
}

export type ExtractResult =
  | {
      status: 200;
      body: {
        action: ActionView;
        fallback: boolean;
        /** The URL could not be read; the UI may suggest pasting the text instead. */
        sourceUnreadable: boolean;
      };
    }
  | { status: 429; retryAfter: number; body: { limited: true } }
  | { status: 400; body: { error: 'invalid_input' } }
  | { status: 503; body: { error: 'unavailable' } };

async function timeZoneOf(db: Db, userId: string): Promise<string> {
  const { data } = await db.from('profiles').select('timezone').eq('id', userId).maybeSingle();
  return data?.timezone ?? 'UTC';
}

async function usedFallbacks(db: Db, userId: string): Promise<string[]> {
  const { data } = await db
    .from('user_actions')
    .select('action_text')
    .eq('user_id', userId)
    .eq('source_summary', FALLBACK_SOURCE_SUMMARY);
  return (data ?? []).map((row) => row.action_text);
}

export async function extractAction(deps: ExtractDeps, rawInput: unknown): Promise<ExtractResult> {
  const { db, service, userId, provider } = deps;
  const started = Date.now();
  const timeZone = await timeZoneOf(db, userId);

  const rate = await consumeRateLimit(service, userId, AGENT_ID, localDate(timeZone), dailyLimit);
  if (!rate.allowed && !rate.unavailable) {
    return { status: 429, retryAfter: retryAfterSeconds(timeZone), body: { limited: true } };
  }
  // The limiter could not be reached: no provider call, but still an action.
  const limiterDown = !rate.allowed;

  const parsed = ExtractInput.safeParse(rawInput);
  if (!parsed.success) return { status: 400, body: { error: 'invalid_input' } };
  const { url, text } = parsed.data;

  let source = '';
  if (limiterDown) {
    source = '';
  } else if (text) {
    source = capSource(text);
  } else if (url) {
    try {
      const page = await (deps.fetchPage ?? guardedFetch)(url);
      source = readableText(page.html);
    } catch {
      // Blocked, slow, not HTML, gone: all the same to the user — no error.
      source = '';
    }
  }

  const run: AgentRun<{ action: string; source_summary: string }> | null = source
    ? await runAgent(provider, prompt, source, withinWordLimit)
    : null;

  const extracted = run?.ok
    ? { action: run.output.action, summary: run.output.source_summary }
    : { action: pickFallbackAction(await usedFallbacks(db, userId)), summary: FALLBACK_SOURCE_SUMMARY };

  const { data: row, error } = await db
    .from('user_actions')
    .insert({
      user_id: userId,
      action_text: extracted.action,
      source_url: url ?? null,
      source_summary: extracted.summary,
    })
    .select('id, action_text, source_summary, source_url')
    .single();

  const errorCode: LoggedErrorCode | null = limiterDown
    ? 'LIMITER_UNAVAILABLE'
    : run === null
      ? 'SOURCE_UNREADABLE'
      : run.ok
        ? null
        : run.code;
  await logAgentCall(service, {
    agentId: AGENT_ID,
    userId,
    model: prompt.model,
    inputTokens: run?.usage.inputTokens ?? null,
    outputTokens: run?.usage.outputTokens ?? null,
    latencyMs: Date.now() - started,
    success: run?.ok === true,
    errorCode,
  });

  if (error || !row) return { status: 503, body: { error: 'unavailable' } };

  // A first import should not wait for the next hourly sweep to reach the monitor.
  await db.rpc('ensure_daily_challenge');

  return {
    status: 200,
    body: {
      action: {
        id: row.id,
        actionText: row.action_text,
        sourceSummary: row.source_summary,
        sourceUrl: row.source_url,
      },
      fallback: run?.ok !== true,
      sourceUnreadable: run === null && Boolean(url) && !limiterDown,
    },
  };
}
