// lib/agents/openai.ts — errors leave the provider as codes, never as text
// (spec/04-ai-agents.md §3). The fetch is injected: nothing here reaches OpenAI.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { OpenAIProvider } from '../../lib/agents/openai.ts';
import { AgentError } from '../../lib/agents/provider.ts';

const REQUEST = {
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 200,
  system: 'system prompt',
  user: 'SENTINEL-ENTRY-TEXT',
};

function provider(fetchImpl: typeof fetch, timeoutMs?: number) {
  return new OpenAIProvider({ apiKey: 'test-key', fetch: fetchImpl, timeoutMs });
}

async function failure(p: OpenAIProvider): Promise<AgentError> {
  try {
    await p.complete(REQUEST);
  } catch (error) {
    assert.ok(error instanceof AgentError, `not an AgentError: ${String(error)}`);
    return error;
  }
  assert.fail('complete() resolved');
}

describe('OpenAIProvider', () => {
  it('sends JSON mode and the prompt parameters, and returns content with usage', async () => {
    let sent: Record<string, unknown> = {};
    const p = provider(async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return Response.json({
        choices: [{ message: { content: '{"action":"x"}' } }],
        usage: { prompt_tokens: 12, completion_tokens: 5 },
      });
    });
    const result = await p.complete(REQUEST);
    assert.deepEqual(result, { content: '{"action":"x"}', inputTokens: 12, outputTokens: 5 });
    assert.deepEqual(sent.response_format, { type: 'json_object' });
    assert.equal(sent.max_tokens, 200);
    assert.equal(sent.temperature, 0.7);
  });

  it('maps a 429 to RATE_LIMIT', async () => {
    const error = await failure(provider(async () => new Response('slow down', { status: 429 })));
    assert.equal(error.code, 'RATE_LIMIT');
  });

  it('maps a network failure to PROVIDER_ERROR — the blocked-network case', async () => {
    const error = await failure(provider(async () => {
      throw new TypeError('fetch failed: getaddrinfo ENOTFOUND api.openai.com');
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

  it('maps unparseable output to PARSE_FAIL', async () => {
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
    const p = new OpenAIProvider({ apiKey: '', fetch: async () => { called = true; return Response.json({}); } });
    const error = await failure(p);
    assert.equal(error.code, 'PROVIDER_ERROR');
    assert.equal(called, false);
  });
});
