// lib/agents/gemini.ts — errors leave the provider as codes, never as text
// (spec/04-ai-agents.md §3). The fetch is injected: nothing here reaches Google.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GeminiProvider } from '../../lib/agents/gemini.ts';
import { AgentError } from '../../lib/agents/provider.ts';

const REQUEST = {
  model: 'gemini-test-model',
  temperature: 0.3,
  maxTokens: 150,
  system: 'system prompt',
  user: 'SENTINEL-ARTICLE-TEXT',
};

function provider(fetchImpl: typeof fetch, timeoutMs?: number) {
  return new GeminiProvider({ apiKey: 'test-key', fetch: fetchImpl, timeoutMs });
}

async function failure(p: GeminiProvider): Promise<AgentError> {
  try {
    await p.complete(REQUEST);
  } catch (error) {
    assert.ok(error instanceof AgentError, `not an AgentError: ${String(error)}`);
    return error;
  }
  assert.fail('complete() resolved');
}

function answer(text: string) {
  return Response.json({
    candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 },
  });
}

interface SentBody {
  systemInstruction: { parts: { text: string }[] };
  contents: { parts: { text: string }[] }[];
  generationConfig: { responseMimeType: string; maxOutputTokens: number; temperature: number };
}

describe('GeminiProvider', () => {
  it('sends JSON mode, the prompt parameters and the key in a header, and returns content with usage', async () => {
    let url = '';
    let headers = new Headers();
    let sent: SentBody | null = null;
    const p = provider(async (input, init) => {
      url = String(input);
      headers = new Headers(init?.headers);
      sent = JSON.parse(String(init?.body)) as SentBody;
      return answer('{"action":"x"}');
    });

    const result = await p.complete(REQUEST);
    assert.deepEqual(result, { content: '{"action":"x"}', inputTokens: 12, outputTokens: 5 });
    assert.match(url, /\/models\/gemini-test-model:generateContent$/);
    assert.ok(!url.includes('test-key'), 'the key never goes in the URL');
    assert.equal(headers.get('x-goog-api-key'), 'test-key');

    const body = sent as SentBody | null;
    assert.equal(body?.generationConfig.responseMimeType, 'application/json');
    assert.equal(body?.generationConfig.maxOutputTokens, 150);
    assert.equal(body?.generationConfig.temperature, 0.3);
    assert.equal(body?.systemInstruction.parts[0]?.text, 'system prompt');
    assert.equal(body?.contents[0]?.parts[0]?.text, 'SENTINEL-ARTICLE-TEXT');
  });

  it('maps a 429 to RATE_LIMIT — the free tier’s per-minute limit', async () => {
    const error = await failure(provider(async () => new Response('slow down', { status: 429 })));
    assert.equal(error.code, 'RATE_LIMIT');
  });

  it('maps a network failure to PROVIDER_ERROR — the blocked-network case', async () => {
    const error = await failure(provider(async () => {
      throw new TypeError('fetch failed: getaddrinfo ENOTFOUND generativelanguage.googleapis.com');
    }));
    assert.equal(error.code, 'PROVIDER_ERROR');
  });

  it('maps its own timeout to TIMEOUT', async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
      });
    const error = await failure(provider(hang, 50));
    assert.equal(error.code, 'TIMEOUT');
  });

  it('maps a safety block — a candidate with no text — to PARSE_FAIL', async () => {
    const blocked = Response.json({ candidates: [{ finishReason: 'SAFETY' }], promptFeedback: {} });
    const error = await failure(provider(async () => blocked));
    assert.equal(error.code, 'PARSE_FAIL');
  });

  it('maps an unparseable body to PARSE_FAIL', async () => {
    const error = await failure(provider(async () => new Response('<html>oops</html>', { status: 200 })));
    assert.equal(error.code, 'PARSE_FAIL');
  });

  it('never lets the provider’s error text out — it may echo the input', async () => {
    const echo = `{"error":{"message":"Invalid input: ${REQUEST.user}"}}`;
    const error = await failure(provider(async () => new Response(echo, { status: 400 })));
    assert.equal(error.code, 'PROVIDER_ERROR');
    assert.equal(error.message, 'PROVIDER_ERROR');
    assert.ok(!JSON.stringify(error).includes('SENTINEL'));
    assert.ok(!String(error.stack).includes('SENTINEL'));
  });

  it('refuses to run without a key rather than sending an empty one', async () => {
    let called = false;
    const p = new GeminiProvider({ apiKey: '', fetch: async () => { called = true; return answer('{}'); } });
    const error = await failure(p);
    assert.equal(error.code, 'PROVIDER_ERROR');
    assert.equal(called, false);
  });
});
