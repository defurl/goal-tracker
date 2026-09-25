// content_extraction_agent — spec/04-ai-agents.md §2. Verbatim from the spec.
//
// Changing this prompt means adding CONTENT_EXTRACTION_V2 beside it, never
// editing V1 in place (04 §7): the version that produced a row must stay
// traceable.

import { z } from 'zod';

export const CONTENT_EXTRACTION_V1 = {
  version: '1.0',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 150,
  systemPrompt: `You are an action extraction assistant. Given the following article or text, extract exactly ONE concrete micro-action the reader can take in under 2 minutes.

Rules:
1. The action must start with an imperative verb (Write, Call, Try, Block, ...).
2. Maximum 40 words.
3. No motivational filler. Pure action.
4. Return JSON: { "action": "<text>", "source_summary": "<1 sentence>" }`,
  schema: z.object({
    action: z.string().min(1).max(300),
    source_summary: z.string().min(1).max(500),
  }),
} as const;

export type ExtractedAction = z.infer<typeof CONTENT_EXTRACTION_V1.schema>;

/** FR-1.2 / AC-1.1. The schema caps characters; the rule is words. */
export const MAX_ACTION_WORDS = 40;

export function withinWordLimit(output: ExtractedAction): boolean {
  return output.action.trim().split(/\s+/).length <= MAX_ACTION_WORDS;
}
