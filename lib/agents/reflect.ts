// journal_analysis_agent, end to end — spec/04-ai-agents.md §1 and §3.
// THE PRIVACY-CRITICAL PATH (FR-3.6).
//
// `entry_text` exists in three places and no others: the request body, this
// function's memory for the length of the call, and the provider request. So:
//
//   - it is never written to journal_entries — the table has no column for it
//   - it is never in agent_logs — logAgentCall() has no field that could hold it
//   - it is never in an error, a console line or a structured log field.
//     DO NOT log `rawInput`, `parsed`, or a Zod error here to debug a failure.
//     That one line would break the product's central promise. A failure is
//     visible as its code in agent_logs; that is all the debugging it gets.
//
// `support_response` (D-13) is returned to the caller and never stored: not in
// journal_entries, not in agent_logs — the call is logged as an ordinary
// success.
//
// What IS stored: mood, mood_score and tags always — the entry is saved even
// when the reflection is not — and the four ai_* summary fields only when the
// agent produced them. A fallback is shown, never stored as if it were an
// insight about the entry. PROPOSED.

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { localDate } from '../data/time.ts';
import { MAX_ENTRY_CHARS, MOOD_KEYS, moodScore, TOPIC_TAGS } from '../journal/moods.ts';
import { GENTLE_REFLECTION } from '../prompts/fallbacks.ts';
import { AGENTS } from '../prompts/index.ts';
import type { JournalReflection } from '../prompts/journalAnalysis.ts';
import type { Database } from '../supabase/database.types.ts';
import { consumeRateLimit, logAgentCall, retryAfterSeconds } from './ops.ts';
import type { AgentProvider } from './provider.ts';
import { runAgent } from './run.ts';

type Db = SupabaseClient<Database>;

const AGENT_ID = 'journal_analysis_agent';
const { prompt, dailyLimit } = AGENTS[AGENT_ID];

export interface ReflectDeps {
  provider: AgentProvider;
  /** The signed-in user's own client. journal_entries is written through RLS. */
  db: Db;
  /** Service role, for rate_limits and agent_logs only. */
  service: Db;
  userId: string;
}

export const ReflectInput = z.object({
  entry_text: z.string().trim().min(1).max(MAX_ENTRY_CHARS),
  mood: z.enum(MOOD_KEYS),
  tags: z.array(z.enum(TOPIC_TAGS as [string, ...string[]])).max(TOPIC_TAGS.length).default([]),
});

export interface ReflectBody {
  reflection: JournalReflection;
  /** True when the reflection is the curated one, not the agent's. */
  fallback: boolean;
}

export type ReflectResult =
  | { status: 200; body: ReflectBody }
  | { status: 429; retryAfter: number; body: ReflectBody & { limited: true } }
  | { status: 400; body: { error: 'invalid_input' } }
  | { status: 503; body: { error: 'unavailable' } };

export async function reflectOnEntry(deps: ReflectDeps, rawInput: unknown): Promise<ReflectResult> {
  const { db, service, userId, provider } = deps;
  const started = Date.now();

  const { data: profile } = await db.from('profiles').select('timezone').eq('id', userId).maybeSingle();
  const timeZone = profile?.timezone ?? 'UTC';
  const today = localDate(timeZone);

  const rate = await consumeRateLimit(service, userId, AGENT_ID, today, dailyLimit);

  const parsed = ReflectInput.safeParse(rawInput);
  if (!parsed.success) return { status: 400, body: { error: 'invalid_input' } };
  const { mood, tags } = parsed.data;

  // Mood and tags first: the entry is saved whether or not a reflection follows.
  const { error: saveError } = await db
    .from('journal_entries')
    .upsert(
      { user_id: userId, date: today, mood, mood_score: moodScore(mood) ?? 0, tags },
      { onConflict: 'user_id,date' },
    );
  if (saveError) return { status: 503, body: { error: 'unavailable' } };

  if (!rate.allowed && !rate.unavailable) {
    return {
      status: 429,
      retryAfter: retryAfterSeconds(timeZone),
      body: { reflection: GENTLE_REFLECTION, fallback: true, limited: true },
    };
  }
  if (!rate.allowed) {
    // The limiter could not be reached: no provider call, and no false claim
    // that today's reflections are spent.
    await logAgentCall(service, {
      agentId: AGENT_ID,
      userId,
      model: prompt.model,
      inputTokens: null,
      outputTokens: null,
      latencyMs: Date.now() - started,
      success: false,
      errorCode: 'LIMITER_UNAVAILABLE',
    });
    return { status: 200, body: { reflection: GENTLE_REFLECTION, fallback: true } };
  }

  const run = await runAgent(provider, prompt, parsed.data.entry_text);

  if (run.ok) {
    await db
      .from('journal_entries')
      .update({
        ai_summary: run.output.summary,
        ai_emotion: run.output.primary_emotion,
        ai_strength: run.output.strength,
        ai_next_action: run.output.next_action,
      })
      .eq('user_id', userId)
      .eq('date', today);
  }

  await logAgentCall(service, {
    agentId: AGENT_ID,
    userId,
    model: prompt.model,
    inputTokens: run.usage.inputTokens,
    outputTokens: run.usage.outputTokens,
    latencyMs: Date.now() - started,
    success: run.ok,
    errorCode: run.ok ? null : run.code,
  });

  return run.ok
    ? { status: 200, body: { reflection: run.output, fallback: false } }
    : { status: 200, body: { reflection: GENTLE_REFLECTION, fallback: true } };
}
