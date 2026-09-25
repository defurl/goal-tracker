// GeminiProvider — the one live AgentProvider. Owner decision 2026-09-25:
// Gemini (Google AI Studio key) replaces OpenAI, amending D-19.
//
// Plain fetch against the Generative Language REST API, JSON mode on
// (responseMimeType). Errors leave this file as a CODE only (04 §3): a failed
// response's body is never read, because provider error payloads can echo the
// input back.
//
// The key goes in the x-goog-api-key header, never the URL — a query string
// ends up in access logs. It is a constructor argument: API-1, keys are read
// only inside app/api/.
//
// FREE-TIER DATA TERMS: on Google's unpaid tier, inputs may be used to improve
// Google's products and may be read by human reviewers. That is why AI Reflect
// is off by default (NEXT_PUBLIC_AI_REFLECT) and journal entries are not sent
// here unless the owner switches it on deliberately — see README, "Getting the
// keys".

import { AgentError, type AgentProvider, type CompletionRequest, type CompletionResult } from './provider.ts';

export interface GeminiProviderOptions {
  apiKey: string;
  /** Injected in tests to simulate a blocked or failing network. */
  fetch?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}

/** The model call's own ceiling; the article fetch has its separate 8 s (04 §2). */
const DEFAULT_TIMEOUT_MS = 8000;

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: unknown }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

export class GeminiProvider implements AgentProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly baseUrl: string;

  constructor(options: GeminiProviderOptions) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.baseUrl = options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    if (!this.apiKey) throw new AgentError('PROVIDER_ERROR');

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/models/${encodeURIComponent(request.model)}:generateContent`, {
        method: 'POST',
        headers: {
          'x-goog-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: 'user', parts: [{ text: request.user }] }],
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens,
            responseMimeType: 'application/json',
            // The token caps (04 §2, §3) were sized for an answer, not for
            // reasoning; a thinking pass would spend them before any JSON.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      // Never rethrow `error`: it may carry the request.
      const name = error instanceof Error ? error.name : '';
      throw new AgentError(name === 'TimeoutError' || name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_ERROR');
    }

    if (response.status === 429) throw new AgentError('RATE_LIMIT');
    if (!response.ok) throw new AgentError('PROVIDER_ERROR');

    let body: GenerateContentResponse;
    try {
      body = (await response.json()) as GenerateContentResponse;
    } catch {
      throw new AgentError('PARSE_FAIL');
    }

    // A safety block or an empty candidate has no text: unparseable, so the
    // caller retries once and then falls back.
    const text = (body.candidates?.[0]?.content?.parts ?? [])
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('');
    if (!text) throw new AgentError('PARSE_FAIL');

    return {
      content: text,
      inputTokens: body.usageMetadata?.promptTokenCount ?? null,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? null,
    };
  }
}
