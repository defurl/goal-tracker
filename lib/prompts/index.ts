// The agent registry — spec/04-ai-agents.md §5 and §7. Agent id → the prompt
// version in use, and plan → each agent's per-user daily cap. Routes read from
// here, so moving an agent to a _V2 prompt is one line, and the version logged
// with a result is always the version that produced it.

import { CONTENT_EXTRACTION_V2 } from './contentExtraction.ts';
import { JOURNAL_ANALYSIS_V3 } from './journalAnalysis.ts';

// Earlier versions stay in their files as the record of what produced earlier rows.
export const AGENTS = {
  content_extraction_agent: { prompt: CONTENT_EXTRACTION_V2 },
  journal_analysis_agent: { prompt: JOURNAL_ANALYSIS_V3 },
} as const;

export type AgentId = keyof typeof AGENTS;

/** The values `user_plans.plan` admits (025). Every user is on 'free' for now (D-24 §7). */
export const PLANS = ['free'] as const;
export type Plan = (typeof PLANS)[number];

export const DAILY_LIMITS: Record<Plan, Record<AgentId, number>> = {
  free: { content_extraction_agent: 20, journal_analysis_agent: 3 },
};

/** Anything the table does not hold — no row, an unknown value — reads as 'free'. */
export function planOf(value: unknown): Plan {
  return PLANS.find((p) => p === value) ?? 'free';
}

/** Phase 1 selects by SQL, no model (04 §4); the id is kept for the log and the route. */
export const CHALLENGE_AGENT_ID = 'challenge_generator_agent';
