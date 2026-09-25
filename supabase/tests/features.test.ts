// 017–021 — the rate limiter, the sweep entry point, and the feature write
// paths that award points (019 challenge, 020 habits, 021 milestones).
//
// Every award asserted here is an exact total, because "increases by 10" is the
// acceptance criterion (AC-2.2) and a double award is the bug worth catching.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { admin, createUser, deleteUsers, RLS_DENIED, seed, type TestUser } from './harness.ts';

after(deleteUsers);

/** Profiles start at UTC (handle_new_user), so the functions' "today" is the UTC date. */
function utcDay(offset = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function action(u: TestUser, text: string): Promise<string> {
  const row = await seed<{ id: string }>('user_actions', {
    user_id: u.id, action_text: text, source_summary: 'test',
  });
  return row.id;
}

describe('consume_rate_limit() — 017', () => {
  it('counts atomically for the service role', async () => {
    const u = await createUser('rate');
    for (const expected of [1, 2, 3]) {
      const { data, error } = await admin.rpc('consume_rate_limit', {
        p_user_id: u.id, p_agent_id: 'journal_analysis_agent', p_date: utcDay(),
      });
      assert.equal(error, null);
      assert.equal(data, expected);
    }
  });

  it('counts concurrent calls without losing one', async () => {
    const u = await createUser('rate-race');
    const calls = Array.from({ length: 8 }, () =>
      admin.rpc('consume_rate_limit', {
        p_user_id: u.id, p_agent_id: 'content_extraction_agent', p_date: utcDay(),
      }),
    );
    const counts = (await Promise.all(calls)).map((r) => r.data as number).sort((a, b) => a - b);
    assert.deepEqual(counts, [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('is not callable by a signed-in user', async () => {
    const u = await createUser('rate-user');
    const { error } = await u.client.rpc('consume_rate_limit', {
      p_user_id: u.id, p_agent_id: 'journal_analysis_agent', p_date: utcDay(),
    });
    assert.equal(error?.code, RLS_DENIED);
  });
});

describe('run_challenge_sweep() — 018', () => {
  it('seeds and logs the run as the model-less agent', async () => {
    const u = await createUser('sweep');
    await action(u, 'Write one sentence');
    const { data, error } = await admin.rpc('run_challenge_sweep');
    assert.equal(error, null);
    assert.ok((data as number) >= 1);

    const { data: challenge } = await admin
      .from('daily_challenges').select('date').eq('user_id', u.id).single();
    assert.equal(challenge?.date, utcDay());

    const { data: logs } = await admin
      .from('agent_logs').select('model, success')
      .eq('agent_id', 'challenge_generator_agent').order('created_at', { ascending: false }).limit(1);
    assert.deepEqual(logs?.[0], { model: 'none', success: true });
  });

  it('is not callable by a signed-in user', async () => {
    const u = await createUser('sweep-user');
    const { error } = await u.client.rpc('run_challenge_sweep');
    assert.equal(error?.code, RLS_DENIED);
  });
});
