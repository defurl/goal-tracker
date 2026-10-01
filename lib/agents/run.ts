// Steps 5–6 of the execution pattern (spec/04-ai-agents.md §1): call the
// provider in JSON mode, parse, validate with the prompt's own schema, and on
// failure retry once with the same input. A second failure is returned as a
// code — the caller turns it into a curated fallback (FALLBACK-1). Nothing
// here throws, logs, or keeps the input past the call.

import { AGENT_LIMITS } from './limits.ts';
import { AgentError, type AgentErrorCode, type AgentProvider } from './provider.ts';

/**
 * The one thing needed of a Zod schema. Structural, so a schema whose input
 * and output differ (`.default()`) still fits, whichever Zod major is installed.
 */
export interface OutputSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

export interface AgentPrompt<T> {
  version: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  /**
   * Turns the input into the user turn; absent, the input is sent as it is. A
   * prompt that reads third-party text fences it off here, so the framing is
   * versioned with the rule that explains it to the model (04 §7).
   */
  userMessage?: (input: string) => string;
  schema: OutputSchema<T>;
}

export interface Usage {
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export type AgentRun<T> =
  | { ok: true; output: T; usage: Usage }
  | { ok: false; code: AgentErrorCode; usage: Usage };

function add(a: number | null, b: number | null): number | null {
  return a === null && b === null ? null : (a ?? 0) + (b ?? 0);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export const MAX_ATTEMPTS = AGENT_LIMITS.providerAttempts;

/**
 * `accept` is a rule the schema cannot express (the 40-word limit); output it
 * rejects counts as unparseable and is retried like any other.
 */
export async function runAgent<T>(
  provider: AgentProvider,
  prompt: AgentPrompt<T>,
  input: string,
  accept: (output: T) => boolean = () => true,
): Promise<AgentRun<T>> {
  const started = Date.now();
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let code: AgentErrorCode = 'PROVIDER_ERROR';
  const user = prompt.userMessage ? prompt.userMessage(input) : input;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const result = await provider.complete({
        model: prompt.model,
        temperature: prompt.temperature,
        maxTokens: prompt.maxTokens,
        system: prompt.systemPrompt,
        user,
      });
      inputTokens = add(inputTokens, result.inputTokens);
      outputTokens = add(outputTokens, result.outputTokens);

      const parsed = prompt.schema.safeParse(parseJson(result.content));
      if (parsed.success && accept(parsed.data)) {
        return { ok: true, output: parsed.data, usage: { inputTokens, outputTokens, latencyMs: Date.now() - started } };
      }
      code = 'PARSE_FAIL';
    } catch (error) {
      code = error instanceof AgentError ? error.code : 'PROVIDER_ERROR';
    }
  }

  return { ok: false, code, usage: { inputTokens, outputTokens, latencyMs: Date.now() - started } };
}
