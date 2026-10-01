// lib/agents/ — the retry-once ladder and the 6000-character cap of
// spec/04-ai-agents.md §2, and the route input schemas. No network, no
// database: a scripted provider and an in-memory stand-in for the two Supabase
// clients that records every query made through it.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ExtractInput, extractAction } from '../../lib/agents/extract.ts';
import { MAX_SOURCE_CHARS, capSource, readableText } from '../../lib/agents/readable.ts';
import { AgentError, type AgentProvider, type CompletionRequest, type CompletionResult } from '../../lib/agents/provider.ts';
import { ReflectInput, reflectOnEntry } from '../../lib/agents/reflect.ts';
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

// ── a Supabase stand-in ──────────────────────────────────────────────────────

interface Op {
  client: 'db' | 'service';
  table: string;
  method: string;
  args: unknown[];
}

interface Answers {
  /** consume_rate_limit's count after this call; null makes the RPC fail. */
  count?: number | null;
  /** The caller's user_plans.plan; null is no row. */
  plan?: unknown;
}

/**
 * Every query chains and is recorded in `ops`. Awaiting one resolves to
 * `{ data, error: null }`: the caller's zone and plan, an inserted row echoed
 * back, and consume_rate_limit's count from `answers`.
 */
function fakeSupabase(client: Op['client'], ops: Op[], answers: Answers) {
  return {
    from(table: string) {
      let inserted: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'insert', 'upsert', 'update', 'delete']) {
        builder[method] = (...args: unknown[]) => {
          ops.push({ client, table, method, args });
          if (method === 'insert') inserted = args[0] as Record<string, unknown>;
          return builder;
        };
      }
      builder.maybeSingle = async () => {
        if (table === 'profiles') return { data: { timezone: 'UTC' }, error: null };
        if (table === 'user_plans') return { data: answers.plan === null ? null : { plan: answers.plan ?? 'free' }, error: null };
        return { data: null, error: null };
      };
      builder.single = async () => ({ data: { id: 'row-1', ...inserted }, error: null });
      builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: [], error: null });
      return builder;
    },
    async rpc(name: string, args?: unknown) {
      ops.push({ client, table: name, method: 'rpc', args: [args] });
      if (name !== 'consume_rate_limit') return { data: null, error: null };
      const count = answers.count === undefined ? 1 : answers.count;
      return count === null ? { data: null, error: { message: 'unreachable' } } : { data: count, error: null };
    },
  } as never;
}

/** Answers every request with `content`, and keeps what it was sent. */
function recording(content = GOOD): AgentProvider & { requests: CompletionRequest[] } {
  const requests: CompletionRequest[] = [];
  return {
    requests,
    async complete(request) {
      requests.push(request);
      return { content, inputTokens: 100, outputTokens: 20 };
    },
  };
}

function deps(provider: AgentProvider, ops: Op[], answers: Answers = {}) {
  return {
    provider,
    db: fakeSupabase('db', ops, answers),
    service: fakeSupabase('service', ops, answers),
    userId: 'user-1',
    reflectionEnabled: true,
  };
}

const ENTRY = { entry_text: 'A quiet day at home.', mood: 'calm', tags: ['rest'] };

describe('the agent routes refuse unknown fields — mass assignment', () => {
  it('ExtractInput takes a url or a text, and nothing else', () => {
    assert.ok(ExtractInput.safeParse({ url: 'https://example.com/a' }).success);
    assert.ok(ExtractInput.safeParse({ text: 'An article.' }).success);
    for (const extra of [{ user_id: 'someone-else' }, { plan: 'pro' }, { points: 1000 }, { prompt_version: '9.9' }]) {
      assert.equal(ExtractInput.safeParse({ text: 'An article.', ...extra }).success, false, JSON.stringify(extra));
    }
  });

  it('ReflectInput takes entry_text, mood and tags, and nothing else', () => {
    assert.ok(ReflectInput.safeParse(ENTRY).success);
    const extras = [{ user_id: 'someone-else' }, { date: '2020-01-01' }, { ai_summary: 'x' }, { support_response: true }, { mood_score: 2 }];
    for (const extra of extras) {
      assert.equal(ReflectInput.safeParse({ ...ENTRY, ...extra }).success, false, JSON.stringify(extra));
    }
  });

  it('counts a prototype key in the JSON body as an unknown field', () => {
    for (const body of ['{"text":"x","__proto__":{"plan":"pro"}}', '{"text":"x","constructor":{"prototype":{}}}']) {
      assert.equal(ExtractInput.safeParse(JSON.parse(body)).success, false, body);
    }
  });

  it('answers an extra field with a 400, before any model call or write', async () => {
    const ops: Op[] = [];
    const provider = recording();
    assert.equal((await extractAction(deps(provider, ops), { text: 'An article.', user_id: 'someone-else' })).status, 400);
    assert.equal((await reflectOnEntry(deps(provider, ops), { ...ENTRY, date: '2020-01-01' })).status, 400);
    assert.equal(provider.requests.length, 0);
    assert.ok(!ops.some((op) => ['insert', 'upsert', 'update', 'delete'].includes(op.method)), 'nothing written');
    // 04 §1 counts the request before it validates the body: a 400 still spends one of the day's calls.
    assert.equal(ops.filter((op) => op.table === 'consume_rate_limit').length, 2);
  });
});
