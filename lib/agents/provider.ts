// The provider seam — spec/04-ai-agents.md §8, D-19. One interface, one live
// implementation: GeminiProvider, which replaced OpenAIProvider by owner
// decision on 2026-09-25. Moving providers again is an afternoon, not a refactor.
//
// Errors cross this seam as a CODE, never a message (04 §3). Provider error
// payloads can echo the request back, and for the journal agent the request is
// the entry text FR-3.6 forbids persisting anywhere — including a log line.

export const AGENT_ERROR_CODES = ['RATE_LIMIT', 'TIMEOUT', 'PARSE_FAIL', 'PROVIDER_ERROR'] as const;
export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[number];

/** Carries a code and nothing else. Its message is the code. */
export class AgentError extends Error {
  readonly code: AgentErrorCode;

  constructor(code: AgentErrorCode) {
    super(code);
    this.name = 'AgentError';
    this.code = code;
  }
}

export interface CompletionRequest {
  model: string;
  temperature: number;
  maxTokens: number;
  system: string;
  user: string;
}

export interface CompletionResult {
  /** Raw model output; JSON mode is on, but it is parsed and validated by the caller. */
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AgentProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>;
}
