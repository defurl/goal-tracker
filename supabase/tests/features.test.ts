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

async function total(userId: string): Promise<number> {
  const { data } = await admin.from('glow_points').select('total').eq('user_id', userId);
  return (data?.[0]?.total as number | undefined) ?? 0;
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

describe('Daily Challenge — 019', () => {
  it('ensure_daily_challenge() seeds today once, and not without a pending action', async () => {
    const empty = await createUser('ensure-empty');
    assert.equal((await empty.client.rpc('ensure_daily_challenge')).error, null);
    const none = await admin.from('daily_challenges').select('id').eq('user_id', empty.id);
    assert.equal(none.data?.length, 0);

    const u = await createUser('ensure');
    await action(u, 'Drink a glass of water');
    await u.client.rpc('ensure_daily_challenge');
    await u.client.rpc('ensure_daily_challenge');
    const { data } = await admin.from('daily_challenges').select('date').eq('user_id', u.id);
    assert.deepEqual(data, [{ date: utcDay() }]);
  });

  it('rolls to a different pending action, and stops at three (D-15)', async () => {
    const u = await createUser('roll');
    const first = await action(u, 'one');
    await action(u, 'two');
    const c = await seed<{ id: string }>('daily_challenges', {
      user_id: u.id, action_id: first, date: utcDay(),
    });

    let previous = first;
    for (let i = 1; i <= 3; i++) {
      assert.equal((await u.client.rpc('roll_challenge', { p_challenge_id: c.id })).error, null);
      const { data } = await admin.from('daily_challenges').select().eq('id', c.id).single();
      assert.equal(data?.roll_count, i);
      assert.notEqual(data?.action_id, previous);
      previous = data?.action_id as string;
    }
    const fourth = await u.client.rpc('roll_challenge', { p_challenge_id: c.id });
    assert.match(fourth.error?.message ?? '', /roll_cap_reached/);
  });

  it('refuses a roll with nothing else to roll to', async () => {
    const u = await createUser('roll-alone');
    const only = await action(u, 'only');
    const c = await seed<{ id: string }>('daily_challenges', {
      user_id: u.id, action_id: only, date: utcDay(),
    });
    const { error } = await u.client.rpc('roll_challenge', { p_challenge_id: c.id });
    assert.match(error?.message ?? '', /no_other_pending/);
  });

  it('awards +30 once and marks the action done (FR-1.6, AC-1.5)', async () => {
    const u = await createUser('complete');
    const a = await action(u, 'Stretch for a minute');
    const c = await seed<{ id: string }>('daily_challenges', {
      user_id: u.id, action_id: a, date: utcDay(),
    });
    for (let i = 0; i < 2; i++) {
      assert.equal((await u.client.rpc('complete_challenge', { p_challenge_id: c.id })).error, null);
    }
    assert.equal(await total(u.id), 30);
    const { data } = await admin.from('user_actions').select('status').eq('id', a).single();
    assert.equal(data?.status, 'done');
  });

  it('awards nothing for a challenge dated any day but today', async () => {
    const u = await createUser('complete-past');
    const a = await action(u, 'backdated');
    // Owner-writable under 012: the user can insert this row themselves.
    const { data: c } = await u.client.from('daily_challenges')
      .insert({ user_id: u.id, action_id: a, date: utcDay(-30) }).select().single();
    await u.client.rpc('complete_challenge', { p_challenge_id: c?.id });
    assert.equal(await total(u.id), 0);
  });
});
