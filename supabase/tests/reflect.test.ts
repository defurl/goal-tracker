// journal_analysis_agent against the local stack — the Phase 2 track B gate:
//
//   1. A database dump taken after a full journal-with-reflection cycle
//      contains NO fragment of the entry text (AC-3.2, FR-3.6).
//   2. A usable reflection with the provider network-blocked (FALLBACK-1).
//
// And D-13: support_response lives in the response alone.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

import { reflectOnEntry } from '../../lib/agents/reflect.ts';
import { GENTLE_REFLECTION } from '../../lib/prompts/fallbacks.ts';
import { brokenService, deps, lastLog, networkBlocked, neverCalled, scripted } from './agentHarness.ts';
import { admin, createUser, deleteUsers } from './harness.ts';

after(deleteUsers);

const REFLECTION = {
  primary_emotion: 'hopeful',
  strength: 'You noticed what helped.',
  next_action: 'Take a ten-minute walk after lunch tomorrow.',
  summary: 'A day that started slowly and found its footing.',
  support_response: false,
};

describe('journal agent', () => {
  it('returns a usable reflection with the provider network-blocked, and saves the entry anyway', async () => {
    const u = await createUser('reflect-blocked');
    const result = await reflectOnEntry(deps(u, networkBlocked), {
      entry_text: 'A long day.', mood: 'tired', tags: ['work'],
    });

    assert.equal(result.status, 200);
    if (result.status === 200) {
      assert.equal(result.body.fallback, true);
      assert.deepEqual(result.body.reflection, GENTLE_REFLECTION);
    }

    const { data } = await admin.from('journal_entries').select().eq('user_id', u.id).single();
    assert.deepEqual(
      { mood: data?.mood, mood_score: data?.mood_score, tags: data?.tags, ai_summary: data?.ai_summary },
      { mood: 'tired', mood_score: -1, tags: ['work'], ai_summary: null },
    );
    assert.equal((await lastLog(u.id, 'journal_analysis_agent')).latest?.error_code, 'PROVIDER_ERROR');
  });

  it('support_response reaches the response and nothing else (D-13)', async () => {
    const u = await createUser('reflect-support');
    const p = scripted(JSON.stringify({ ...REFLECTION, support_response: true }));
    const result = await reflectOnEntry(deps(u, p), { entry_text: 'Everything feels like too much.', mood: 'low' });

    assert.equal(result.status, 200);
    if (result.status === 200) assert.equal(result.body.reflection.support_response, true);

    const { data: entry } = await admin.from('journal_entries').select().eq('user_id', u.id).single();
    assert.ok(!Object.keys(entry ?? {}).some((column) => column.includes('support')));
    const log = await lastLog(u.id, 'journal_analysis_agent');
    // Logged as an ordinary success.
    assert.deepEqual({ success: log.latest?.success, error_code: log.latest?.error_code }, { success: true, error_code: null });
  });

  it('the fourth reflection of the day is a 429 with the gentle fallback, and no provider call', async () => {
    const u = await createUser('reflect-limit');
    const today = new Date().toISOString().slice(0, 10);
    await admin.from('rate_limits').insert({ user_id: u.id, agent_id: 'journal_analysis_agent', date: today, count: 3 });

    const result = await reflectOnEntry(deps(u, neverCalled), { entry_text: 'Fourth.', mood: 'calm' });
    assert.equal(result.status, 429);
    if (result.status === 429) {
      assert.deepEqual(result.body.reflection, GENTLE_REFLECTION);
      assert.ok(result.retryAfter > 0);
    }
    const { data } = await admin.from('journal_entries').select('mood').eq('user_id', u.id).single();
    assert.equal(data?.mood, 'calm');
  });

  it('refuses an entry over 2000 characters rather than truncating it (AC-3.4)', async () => {
    const u = await createUser('reflect-long');
    const result = await reflectOnEntry(deps(u, neverCalled), { entry_text: 'x'.repeat(2001), mood: 'calm' });
    assert.equal(result.status, 400);
  });

  it('with the rate limiter unreachable: the entry is saved and the gentle reflection shown, not a 429', async () => {
    const u = await createUser('reflect-limiter-down');
    const result = await reflectOnEntry(
      { ...deps(u, neverCalled), service: brokenService },
      { entry_text: 'A quiet day.', mood: 'calm' },
    );
    assert.equal(result.status, 200);
    if (result.status === 200) assert.deepEqual(result.body.reflection, GENTLE_REFLECTION);
    const { data } = await admin.from('journal_entries').select('mood').eq('user_id', u.id).single();
    assert.equal(data?.mood, 'calm');
  });
});

describe('THE GATE — AC-3.2: a dump after a reflection holds no fragment of the entry', () => {
  it('finds no trace of the entry anywhere in the database', async () => {
    const u = await createUser('dump');
    // Distinctive words that appear nowhere else, so any one of them in the
    // dump is a fragment of this entry and nothing else.
    const fragments = ['Quillfeather', 'marmalade-lighthouse', 'Zebulon', 'thistledown', 'ossuary7'];
    const entry = `Today ${fragments[0]} called about the ${fragments[1]}. ` +
      `${fragments[2]} walked past the ${fragments[3]} field and the ${fragments[4]} gate.`;

    const p = scripted(JSON.stringify(REFLECTION));
    const result = await reflectOnEntry(deps(u, p), { entry_text: entry, mood: 'content', tags: ['rest'] });
    assert.equal(result.status, 200);
    if (result.status === 200) assert.equal(result.body.fallback, false);

    // The entry really did travel to the provider — so its absence below is
    // the pipeline's doing, not a test that never sent it.
    assert.equal(p.requests[0]?.user, entry);

    const { data: stored } = await admin.from('journal_entries').select('ai_summary').eq('user_id', u.id).single();
    assert.equal(stored?.ai_summary, REFLECTION.summary);

    // Every schema, auth and cron included — not only the tables this code writes.
    const dump = execFileSync(
      'docker',
      ['exec', 'supabase_db_be-better-everyday', 'pg_dump', '-U', 'postgres', '--data-only', 'postgres'],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    );
    assert.ok(dump.includes(REFLECTION.summary), 'the dump is real: it holds the stored summary');
    for (const fragment of [entry, ...fragments]) {
      assert.ok(!dump.includes(fragment), `the dump contains "${fragment}"`);
    }
  });
});
