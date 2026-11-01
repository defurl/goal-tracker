// lib/agents/ — the retry-once ladder and the 6000-character cap of
// spec/04-ai-agents.md §2, and the route input schemas. No network, no
// database: a scripted provider and an in-memory stand-in for the two Supabase
// clients that records every query made through it.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { ExtractInput, draftFromSource, extractAction } from '../../lib/agents/extract.ts';
import { AGENT_LIMITS, WORST_CASE_AGENT_MS } from '../../lib/agents/limits.ts';
import { consumeRateLimit, dailyLimit, retryAfterSeconds } from '../../lib/agents/ops.ts';
import { MAX_SOURCE_CHARS, capSource, readableText } from '../../lib/agents/readable.ts';
import { AgentError, type AgentProvider, type CompletionRequest, type CompletionResult } from '../../lib/agents/provider.ts';
import { ReflectInput, reflectOnEntry } from '../../lib/agents/reflect.ts';
import { MAX_ATTEMPTS, runAgent } from '../../lib/agents/run.ts';
import { CONTENT_EXTRACTION_V1, CONTENT_EXTRACTION_V3, withinWordLimit } from '../../lib/prompts/contentExtraction.ts';
import { GENTLE_REFLECTION } from '../../lib/prompts/fallbacks.ts';
import { AGENTS, DAILY_LIMITS } from '../../lib/prompts/index.ts';

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

  it('frames the input as the prompt says, on every attempt, and sends an unframed prompt as it is', async () => {
    const framed = recording('not json');
    await runAgent(framed, CONTENT_EXTRACTION_V3, 'An "article".');
    assert.equal(framed.requests.length, MAX_ATTEMPTS);
    for (const request of framed.requests) {
      assert.deepEqual(JSON.parse(request.user), { article: 'An "article".' });
      assert.equal(request.system, CONTENT_EXTRACTION_V3.systemPrompt);
    }
    const plain = recording();
    await runAgent(plain, CONTENT_EXTRACTION_V1, 'An "article".');
    assert.equal(plain.requests[0]?.user, 'An "article".');
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

describe('ExtractInput — the URL is checked for its form at the boundary', () => {
  it('takes an http(s) URL, trimmed', () => {
    for (const url of ['https://example.com/a', 'http://example.com/a?b=c#d', ' https://example.com/a ', 'HTTPS://EXAMPLE.COM/A']) {
      assert.ok(ExtractInput.safeParse({ url }).success, url);
    }
  });

  it('refuses any other scheme, a bare host, and a URL carrying credentials', () => {
    const refused = [
      'javascript:alert(1)', 'data:text/html,<script>x()</script>', 'ftp://example.com/', 'file:///etc/passwd',
      'example.com/a', 'https://user:pass@example.com/', 'https://user@example.com/',
    ];
    for (const url of refused) assert.equal(ExtractInput.safeParse({ url }).success, false, url);
  });

  it('leaves where a URL may go to the fetch: a private address is a page that cannot be read, not a 400', () => {
    assert.ok(ExtractInput.safeParse({ url: 'http://169.254.169.254/latest/meta-data/' }).success);
  });

  it('answers a refused URL with a 400: no fetch, no model call, nothing stored', async () => {
    const ops: Op[] = [];
    const provider = recording();
    let fetched = false;
    const fetchPage = async () => {
      fetched = true;
      return { html: '' };
    };
    const result = await extractAction({ ...deps(provider, ops), fetchPage }, { url: 'javascript:alert(document.cookie)' });

    assert.equal(result.status, 400);
    assert.equal(fetched, false);
    assert.equal(provider.requests.length, 0);
    assert.ok(!ops.some((op) => op.table === 'user_actions'), 'nothing stored');
  });
});

// ── AI usage caps ────────────────────────────────────────────────────────────

describe('AI usage caps — per user, per plan, per local day', () => {
  const CAP = DAILY_LIMITS.free.content_extraction_agent;
  const decide = (answers: Answers) =>
    consumeRateLimit(fakeSupabase('service', [], answers), 'user-1', 'content_extraction_agent', '2026-10-01');

  it('allows the cap-th call of the day and refuses the next', async () => {
    assert.deepEqual(await decide({ count: CAP }), { allowed: true });
    assert.deepEqual(await decide({ count: CAP + 1 }), { allowed: false, unavailable: false });
  });

  it('takes the cap from the caller’s plan, reads anything unknown as free, and never writes the plan', async () => {
    for (const plan of ['free', 'pro', '', null, 42]) {
      const ops: Op[] = [];
      const cap = await dailyLimit(fakeSupabase('service', ops, { plan }), 'user-1', 'journal_analysis_agent');
      assert.equal(cap, DAILY_LIMITS.free.journal_analysis_agent, String(plan));
      assert.ok(ops.every((op) => op.method === 'select' || op.method === 'eq'), String(plan));
    }
  });

  it('treats an unreachable counter as unavailable, never as allowed', async () => {
    assert.deepEqual(await decide({ count: null }), { allowed: false, unavailable: true });
  });

  it('answers the call past the cap with a 429 and Retry-After, before the article or the model', async () => {
    const ops: Op[] = [];
    const provider = recording();
    let fetched = false;
    const fetchPage = async () => {
      fetched = true;
      return { html: '' };
    };
    const result = await extractAction({ ...deps(provider, ops, { count: CAP + 1 }), fetchPage }, { url: 'https://example.com/a' });

    assert.equal(result.status, 429);
    if (result.status === 429) {
      assert.deepEqual(result.body, { limited: true });
      assert.ok(result.retryAfter >= 1 && result.retryAfter <= 86400);
    }
    assert.equal(provider.requests.length, 0);
    assert.equal(fetched, false, 'a refused call costs no fetch either');
    assert.ok(!ops.some((op) => op.table === 'user_actions'), 'nothing stored');
  });

  it('gives the journal’s 429 the gentle reflection, and still saves the mood', async () => {
    const ops: Op[] = [];
    const provider = recording();
    const result = await reflectOnEntry(deps(provider, ops, { count: DAILY_LIMITS.free.journal_analysis_agent + 1 }), ENTRY);

    assert.equal(result.status, 429);
    if (result.status === 429) assert.deepEqual(result.body, { reflection: GENTLE_REFLECTION, fallback: true, limited: true });
    assert.equal(provider.requests.length, 0);
    assert.ok(ops.some((op) => op.table === 'journal_entries' && op.method === 'upsert'));
  });

  it('sets Retry-After to the user’s next local midnight', () => {
    assert.equal(retryAfterSeconds('UTC', new Date('2026-10-01T23:59:30Z')), 30);
    assert.equal(retryAfterSeconds('UTC', new Date('2026-10-01T00:00:00Z')), 86400);
    // 23:59:30 in Ho Chi Minh City, UTC+7.
    assert.equal(retryAfterSeconds('Asia/Ho_Chi_Minh', new Date('2026-10-01T16:59:30Z')), 30);
  });
});

describe('AI usage caps — per request', () => {
  it('caps output tokens at the prompt’s own maximum, on both agents', async () => {
    const extract = recording();
    await extractAction(deps(extract, []), { text: 'An article.' });
    const reflect = recording(JSON.stringify({ primary_emotion: 'calm', strength: 's', next_action: 'n', summary: 'x' }));
    await reflectOnEntry(deps(reflect, []), ENTRY);

    const pairs = [
      [extract, AGENTS.content_extraction_agent.prompt],
      [reflect, AGENTS.journal_analysis_agent.prompt],
    ] as const;
    for (const [provider, prompt] of pairs) {
      const request = provider.requests[0];
      assert.deepEqual([request?.model, request?.maxTokens, request?.temperature], [prompt.model, prompt.maxTokens, prompt.temperature]);
    }
    assert.deepEqual([pairs[0][1].maxTokens, pairs[1][1].maxTokens], [150, 200]);
  });

  it('refuses input past its caps, and sends the model no more than the source cap', async () => {
    assert.equal(ExtractInput.safeParse({ url: `https://example.com/${'a'.repeat(AGENT_LIMITS.urlMaxChars)}` }).success, false);
    assert.equal(ExtractInput.safeParse({ text: 'x'.repeat(AGENT_LIMITS.pastedTextMaxChars + 1) }).success, false);
    assert.equal(ReflectInput.safeParse({ ...ENTRY, entry_text: 'x'.repeat(AGENT_LIMITS.entryMaxChars + 1) }).success, false);
    assert.equal(ReflectInput.safeParse({ ...ENTRY, tags: Array(9).fill('work') }).success, false);
    assert.ok(ReflectInput.safeParse({ ...ENTRY, entry_text: 'x'.repeat(AGENT_LIMITS.entryMaxChars) }).success);

    const provider = recording();
    const result = await extractAction(deps(provider, []), { text: 'word '.repeat(AGENT_LIMITS.pastedTextMaxChars / 5) });
    assert.equal(result.status, 200);
    const sent = JSON.parse(provider.requests[0]?.user ?? '') as { article: string };
    assert.equal(sent.article.length, AGENT_LIMITS.sourceMaxChars);
  });

  it('ends inside each route’s maxDuration: the fetch and every model attempt fit', () => {
    for (const route of ['extract', 'reflect']) {
      const source = readFileSync(new URL(`../../app/api/agent/${route}/route.ts`, import.meta.url), 'utf8');
      const seconds = Number(/export const maxDuration = (\d+);/.exec(source)?.[1]);
      assert.ok(seconds * 1000 > WORST_CASE_AGENT_MS, `${route}: maxDuration ${seconds} s against ${WORST_CASE_AGENT_MS} ms`);
    }
  });

  it('records each call for its user: tokens, latency and a code, and nothing else', async () => {
    const ops: Op[] = [];
    await extractAction(deps(recording(), ops), { text: 'An article.' });

    const logs = ops.filter((op) => op.table === 'agent_logs' && op.method === 'insert');
    assert.equal(logs.length, 1);
    const row = logs[0]?.args[0] as Record<string, unknown>;
    assert.deepEqual(Object.keys(row).sort(), [
      'agent_id', 'error_code', 'input_tokens', 'latency_ms', 'model', 'output_tokens', 'success', 'user_id',
    ]);
    assert.deepEqual(
      [row.user_id, row.agent_id, row.input_tokens, row.output_tokens, row.success, row.error_code],
      ['user-1', 'content_extraction_agent', 100, 20, true, null],
    );
  });
});

describe('the Inspiration Inbox draft (D-26 §8)', () => {
  it('returns a draft and saves nothing until the user approves it', async () => {
    const ops: Op[] = [];
    const result = await draftFromSource(deps(recording(), ops), { text: 'An article.', draft: true });
    assert.equal(result.status, 200);
    assert.ok(result.status === 200 && result.body.draft?.actionText);
    assert.ok(!ops.some((o) => o.table === 'user_actions' && o.method === 'insert'), 'nothing inserted');
  });

  it('says plainly that a page could not be read, and invents nothing', async () => {
    const ops: Op[] = [];
    const provider = recording();
    const fetchPage = async () => {
      throw new Error('blocked');
    };
    const result = await draftFromSource({ ...deps(provider, ops), fetchPage }, { url: 'https://example.com/a', draft: true });
    assert.deepEqual(result, { status: 200, body: { draft: null, sourceUnreadable: true } });
    assert.equal(provider.requests.length, 0, 'no model call without a source');
    assert.ok(!ops.some((o) => o.table === 'user_actions' && o.method === 'insert'), 'no fallback action saved');
  });
});
