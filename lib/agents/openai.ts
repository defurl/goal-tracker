// OpenAIProvider — the one live AgentProvider (D-19). Plain fetch against the
// chat completions endpoint: the SDK would add a dependency to do what one
// request does, and its errors carry the provider's message, which is exactly
// what must not escape this file (04 §3).
//
// The API key is a constructor argument, not read here. API-1: keys are read
// only inside app/api/, and this module never touches process.env.

import { AgentError, type AgentProvider, type CompletionRequest, type CompletionResult } from './provider.ts';

export interface OpenAIProviderOptions {
  apiKey: string;
  /** Injected in tests to simulate a blocked or failing network. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}

/** The model call's own ceiling; the article fetch has its separate 8 s (04 §2). */
const DEFAULT_TIMEOUT_MS = 8000;

interface ChatCompletion {
  choices?: { message?: { content?: unknown } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAIProvider implements AgentProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(options: OpenAIProviderOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    if (!this.apiKey) throw new AgentError('PROVIDER_ERROR');

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      // Never rethrow `error`: it may carry the request.
      const name = error instanceof Error ? error.name : '';
      throw new AgentError(name === 'TimeoutError' || name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_ERROR');
    }

    // A failed response's body is never read. It is the payload that may echo
    // the input, and nothing downstream needs more than the status.
    if (response.status === 429) throw new AgentError('RATE_LIMIT');
    if (!response.ok) throw new AgentError('PROVIDER_ERROR');

    let body: ChatCompletion;
    try {
      body = (await response.json()) as ChatCompletion;
    } catch {
      throw new AgentError('PARSE_FAIL');
    }

    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new AgentError('PARSE_FAIL');

    return {
      content,
      inputTokens: body.usage?.prompt_tokens ?? null,
      outputTokens: body.usage?.completion_tokens ?? null,
    };
  }
}
