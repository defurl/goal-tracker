// lib/journal/quoting.ts and its use in the reflect route — D-23 §16: the
// journal summary never quotes the entry (FR-3.6). No network, no database: a
// scripted provider and an in-memory stand-in for the two Supabase clients.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { quotesEntry, sharesRun } from '../../lib/journal/quoting.ts';
import { reflectOnEntry } from '../../lib/agents/reflect.ts';
import type { AgentProvider } from '../../lib/agents/provider.ts';
import { GENTLE_REFLECTION, GENTLE_SUPPORT_REFLECTION } from '../../lib/prompts/fallbacks.ts';
import { AGENTS } from '../../lib/prompts/index.ts';
import { JOURNAL_ANALYSIS_V2, JOURNAL_ANALYSIS_V3 } from '../../lib/prompts/journalAnalysis.ts';

const ENTRY = 'Today I finally told my sister that I have been struggling at work, and she just listened.';

describe('sharesRun() — five words in a row', () => {
  it('catches a lifted clause, ignoring case and punctuation', () => {
    assert.ok(sharesRun(ENTRY, 'You TOLD MY SISTER that I have — and that took courage.'));
  });

  it('lets four shared words through', () => {
    assert.ok(!sharesRun(ENTRY, 'Telling my sister that took courage.'));
  });

  it('never matches against an entry shorter than the run', () => {
    assert.ok(!sharesRun('so tired', 'so tired'));
  });
});

describe('quotesEntry() — each stored field on its own', () => {
  const clean = {
    primary_emotion: 'relief',
    strength: 'You let someone close see what you were carrying.',
    next_action: 'Write down one thing that helped today.',
    summary: 'Opening up to family took courage, and it sounds like it was met with care.',
    support_response: false,
  };

  it('passes a reflection in its own words', () => {
    assert.ok(!quotesEntry(ENTRY, clean));
  });

  it('flags a quote in any one field', () => {
    assert.ok(quotesEntry(ENTRY, { ...clean, strength: 'You have been struggling at work, and you said so.' }));
  });

  it('does not build a run across two fields', () => {
    assert.ok(!quotesEntry(ENTRY, { ...clean, summary: 'Today I finally', strength: 'told my sister' }));
  });
});

describe('JOURNAL_ANALYSIS_V3 — rule 7', () => {
  it('adds the no-quote rule and keeps every rule of V2, rule 6 included', () => {
    assert.match(JOURNAL_ANALYSIS_V3.systemPrompt, /^7\. Never quote the entry\./m);
    for (const line of JOURNAL_ANALYSIS_V2.systemPrompt.split('\n')) {
      assert.ok(JOURNAL_ANALYSIS_V3.systemPrompt.includes(line), line);
    }
    assert.equal(JOURNAL_ANALYSIS_V3.version, '3.0');
  });

  it('is the version the journal agent runs', () => {
    assert.equal(AGENTS.journal_analysis_agent.prompt, JOURNAL_ANALYSIS_V3);
  });
});

describe('GENTLE_SUPPORT_REFLECTION — D-13', () => {
  it('keeps the support path and names no number, service or link', () => {
    assert.equal(GENTLE_SUPPORT_REFLECTION.support_response, true);
    const text = `${GENTLE_SUPPORT_REFLECTION.summary} ${GENTLE_SUPPORT_REFLECTION.next_action} ${GENTLE_SUPPORT_REFLECTION.strength}`;
    assert.doesNotMatch(text, /\d|https?:|www\.|\.com|\.org/i);
  });
});

// ── the route ────────────────────────────────────────────────────────────────

interface Call {
  table: string;
  method: string;
  args: unknown[];
}

/** Every query method chains; awaiting one resolves to `{ data, error: null }`. */
function fakeClient(calls: Call[]) {
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'upsert', 'update', 'insert']) {
        builder[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return builder;
        };
      }
      builder.maybeSingle = async () => ({ data: { timezone: 'UTC' }, error: null });
      builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null });
      return builder;
    },
    // consume_rate_limit: the count after this call, well under the cap.
    rpc: async () => ({ data: 1, error: null }),
  };
  return client as never;
}

function provider(output: object): AgentProvider {
  return {
    async complete() {
      return { content: JSON.stringify(output), inputTokens: 50, outputTokens: 30 };
    },
  };
}

async function reflect(output: object) {
  const db: Call[] = [];
  const service: Call[] = [];
  const result = await reflectOnEntry(
    {
      provider: provider(output),
      db: fakeClient(db),
      service: fakeClient(service),
      userId: 'user-1',
      reflectionEnabled: true,
    },
    { entry_text: ENTRY, mood: 'calm', tags: [] },
  );
  return { result, db, service };
}

const QUOTING = {
  primary_emotion: 'relief',
  strength: 'You told my sister that I have been struggling.',
  next_action: 'Rest.',
  summary: 'A hard thing, said out loud.',
  support_response: false,
};

describe('reflectOnEntry() — a quoting reflection is never stored', () => {
  it('stores and returns a reflection in its own words', async () => {
    const { result, db } = await reflect({ ...QUOTING, strength: 'You let someone in.' });
    assert.equal(result.status, 200);
    assert.ok('reflection' in result.body && !result.body.fallback);
    assert.ok(db.some((c) => c.table === 'journal_entries' && c.method === 'update'));
  });

  it('stores nothing from a quoting one, shows the curated reflection, logs QUOTED_ENTRY', async () => {
    const { result, db, service } = await reflect(QUOTING);
    assert.ok('reflection' in result.body);
    assert.equal(result.body.reflection, GENTLE_REFLECTION);
    assert.equal(result.body.fallback, true);
    assert.ok(!db.some((c) => c.table === 'journal_entries' && c.method === 'update'));
    const log = service.find((c) => c.table === 'agent_logs' && c.method === 'insert');
    assert.ok(log);
    assert.match(JSON.stringify(log.args), /QUOTED_ENTRY/);
  });

  it('keeps the distress path when the quoting reflection flagged it', async () => {
    const { result } = await reflect({ ...QUOTING, support_response: true });
    assert.ok('reflection' in result.body);
    assert.equal(result.body.reflection, GENTLE_SUPPORT_REFLECTION);
  });

  it('never writes the entry text anywhere', async () => {
    const { db, service } = await reflect(QUOTING);
    assert.doesNotMatch(JSON.stringify([...db, ...service]), /struggling at work/);
  });
});
