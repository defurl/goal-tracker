// lib/agents/run.ts and readable.ts — the retry-once ladder and the
// 6000-character cap of spec/04-ai-agents.md §2. No network, no database.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_SOURCE_CHARS, capSource, readableText } from '../../lib/agents/readable.ts';
import { AgentError, type AgentProvider, type CompletionResult } from '../../lib/agents/provider.ts';
import { MAX_ATTEMPTS, runAgent } from '../../lib/agents/run.ts';
import { CONTENT_EXTRACTION_V1, withinWordLimit } from '../../lib/prompts/contentExtraction.ts';

function scripted(...steps: (string | AgentError)[]): AgentProvider & { calls: number } {
  const p = {
    calls: 0,
    async complete(): Promise<CompletionResult> {
      const step = steps[p.calls++];
      if (step instanceof AgentError) throw step;
      return { content: step ?? '', inputTokens: 100, outputTokens: 20 };
    },
  };
  return p;
}

const GOOD = JSON.stringify({ action: 'Write one sentence about today.', source_summary: 'An article.' });

describe('runAgent() — retry once, then a code', () => {
  it('returns the first valid output', async () => {
    const p = scripted(GOOD);
    const run = await runAgent(p, CONTENT_EXTRACTION_V1, 'text');
    assert.ok(run.ok);
    assert.equal(p.calls, 1);
  });

  it('retries unparseable output once, and sums the tokens of both attempts', async () => {
    const p = scripted('not json', GOOD);
    const run = await runAgent(p, CONTENT_EXTRACTION_V1, 'text');
    assert.ok(run.ok);
    assert.equal(p.calls, 2);
    assert.equal(run.usage.inputTokens, 200);
  });

  it('gives up after two attempts with PARSE_FAIL', async () => {
    const p = scripted('{}', '{"action":""}', GOOD);
    const run = await runAgent(p, CONTENT_EXTRACTION_V1, 'text');
    assert.equal(run.ok, false);
    assert.equal(p.calls, MAX_ATTEMPTS);
    if (!run.ok) assert.equal(run.code, 'PARSE_FAIL');
  });

  it('reports the provider’s code when the provider fails twice', async () => {
    const p = scripted(new AgentError('TIMEOUT'), new AgentError('TIMEOUT'));
    const run = await runAgent(p, CONTENT_EXTRACTION_V1, 'text');
    assert.equal(run.ok, false);
    if (!run.ok) assert.equal(run.code, 'TIMEOUT');
  });

  it('treats a 41-word action as unparseable (FR-1.2)', async () => {
    const long = JSON.stringify({ action: Array(41).fill('word').join(' '), source_summary: 'x' });
    const run = await runAgent(scripted(long, long), CONTENT_EXTRACTION_V1, 'text', withinWordLimit);
    assert.equal(run.ok, false);
  });

  it('never throws, even when the provider throws something that is not an AgentError', async () => {
    const p: AgentProvider = { complete: async () => { throw new Error('boom: SENTINEL'); } };
    const run = await runAgent(p, CONTENT_EXTRACTION_V1, 'text');
    assert.equal(run.ok, false);
    if (!run.ok) assert.equal(run.code, 'PROVIDER_ERROR');
  });
});

describe('readable text — the 6000-character cap (04 §2, §6)', () => {
  it('keeps the lead and drops the end', () => {
    const text = `LEAD ${'x'.repeat(10_000)} TAIL`;
    const capped = capSource(text);
    assert.equal(capped.length, MAX_SOURCE_CHARS);
    assert.ok(capped.startsWith('LEAD'));
    assert.ok(!capped.includes('TAIL'));
  });

  it('extracts the article and leaves the chrome', () => {
    const paragraph = 'Block fifteen minutes each morning for the one task that matters most. '.repeat(12);
    const html = `<html><head><title>t</title></head><body>
      <nav>Home About Subscribe</nav>
      <article><h1>Focus</h1><p>${paragraph}</p><p>${paragraph}</p></article>
      <footer>© Example</footer></body></html>`;
    const text = readableText(html);
    assert.match(text, /Block fifteen minutes/);
    assert.ok(!text.includes('Subscribe'));
  });

  it('falls back to body text when there is no article to find', () => {
    assert.equal(readableText('<html><body><p>Just this.</p></body></html>'), 'Just this.');
  });
});
