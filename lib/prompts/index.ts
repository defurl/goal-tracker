// The agent registry — spec/04-ai-agents.md §5 and §7. Agent id → the prompt
// version in use and its per-user daily cap. Routes read from here, so moving
// an agent to a _V2 prompt is one line, and the version logged with a result
// is always the version that produced it.

import { CONTENT_EXTRACTION_V1 } from './contentExtraction.ts';
import { JOURNAL_ANALYSIS_V1 } from './journalAnalysis.ts';

export const AGENTS = {
  content_extraction_agent: { prompt: CONTENT_EXTRACTION_V1, dailyLimit: 20 },
  journal_analysis_agent: { prompt: JOURNAL_ANALYSIS_V1, dailyLimit: 3 },
} as const;

export type AgentId = keyof typeof AGENTS;

/** Phase 1 selects by SQL, no model (04 §4); the id is kept for the log and the route. */
export const CHALLENGE_AGENT_ID = 'challenge_generator_agent';
