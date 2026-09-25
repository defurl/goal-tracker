// 017–021 — the rate limiter, the sweep entry point, and the feature write
// paths that award points (019 challenge, 020 habits, 021 milestones).
//
// Every award asserted here is an exact total, because "increases by 10" is the
// acceptance criterion (AC-2.2) and a double award is the bug worth catching.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { admin, anonKey, createUser, deleteUsers, RLS_DENIED, seed, url, type TestUser } from './harness.ts';

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

async function habit(u: TestUser, type: 'build' | 'break', extra: Record<string, unknown> = {}) {
  return seed<{ id: string }>('habits', { user_id: u.id, name: `${type} habit`, type, ...extra });
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

describe('log_habit() — 020', () => {
  it('build +10 and Perfect Day +25, once each however often it is re-checked', async () => {
    const u = await createUser('build');
    const h = await habit(u, 'build');
    for (const completed of [true, false, true]) {
      assert.equal((await u.client.rpc('log_habit', { p_habit_id: h.id, p_completed: completed })).error, null);
    }
    assert.equal(await total(u.id), 35);
    const { data } = await admin.from('habit_logs').select('completed, points_awarded').eq('habit_id', h.id).single();
    assert.deepEqual(data, { completed: true, points_awarded: 10 });
  });

  it('break avoided +15; a relapse awards 0, never less (D-08)', async () => {
    const u = await createUser('break');
    const avoided = await habit(u, 'break');
    const relapsed = await habit(u, 'break');
    await u.client.rpc('log_habit', { p_habit_id: relapsed.id, p_completed: false });
    assert.equal(await total(u.id), 0);
    await u.client.rpc('log_habit', { p_habit_id: avoided.id, p_completed: true });
    // 1 of 2 due is 50 % — no Perfect Day.
    assert.equal(await total(u.id), 15);
    const { data } = await admin.from('habit_logs').select('points_awarded').eq('habit_id', relapsed.id).single();
    assert.equal(data?.points_awarded, 0);
  });

  it('a habit not due today is not in the Perfect Day denominator (AC-2.7)', async () => {
    const u = await createUser('due');
    const due = await habit(u, 'build');
    const today = new Date().getUTCDay();
    await habit(u, 'build', { frequency: { days: [(today + 1) % 7] } });
    await u.client.rpc('log_habit', { p_habit_id: due.id, p_completed: true });
    assert.equal(await total(u.id), 35);
  });

  it('recomputes the streak, and a seventh day awards +50', async () => {
    const u = await createUser('streak');
    const h = await habit(u, 'build', { created_at: new Date(Date.now() - 10 * 86400e3).toISOString() });
    for (let back = 1; back <= 6; back++) {
      await seed('habit_logs', { habit_id: h.id, user_id: u.id, date: utcDay(-back), completed: true });
    }
    await u.client.rpc('log_habit', { p_habit_id: h.id, p_completed: true });
    const { data } = await admin.from('habits').select('streak, longest_streak').eq('id', h.id).single();
    assert.deepEqual(data, { streak: 7, longest_streak: 7 });
    assert.equal(await total(u.id), 10 + 50 + 25);
  });

  it('bounds habit awards at ten a day, so archive-and-recreate mints nothing', async () => {
    const u = await createUser('churn');
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) ids.push((await habit(u, 'build')).id);
    for (const id of ids) await u.client.rpc('log_habit', { p_habit_id: id, p_completed: true });
    const afterTen = await total(u.id);
    assert.equal(afterTen, 100 + 25);

    await u.client.from('habits').update({ archived_at: new Date().toISOString() }).eq('id', ids[0] as string);
    const fresh = await habit(u, 'break');
    await u.client.rpc('log_habit', { p_habit_id: fresh.id, p_completed: true });
    assert.equal(await total(u.id), afterTen);
  });

  it('refuses an archived habit', async () => {
    const u = await createUser('archived');
    const h = await habit(u, 'build', { archived_at: new Date().toISOString() });
    const { error } = await u.client.rpc('log_habit', { p_habit_id: h.id, p_completed: true });
    assert.match(error?.message ?? '', /habit_not_found/);
  });
});

describe('set_milestone() — 021', () => {
  it('+100 when the last milestone completes, once ever (AC-4.2)', async () => {
    const u = await createUser('goal');
    const goal = await seed<{ id: string }>('goals', {
      user_id: u.id, title: 'Run 5k', start_date: utcDay(-5), target_date: utcDay(30),
    });
    const m1 = await seed<{ id: string }>('milestones', { goal_id: goal.id, user_id: u.id, title: 'a' });
    const m2 = await seed<{ id: string }>('milestones', { goal_id: goal.id, user_id: u.id, title: 'b' });

    await u.client.rpc('set_milestone', { p_milestone_id: m1.id, p_complete: true });
    assert.equal(await total(u.id), 0);
    await u.client.rpc('set_milestone', { p_milestone_id: m2.id, p_complete: true });
    assert.equal(await total(u.id), 100);
    let row = await admin.from('goals').select('completed_at').eq('id', goal.id).single();
    assert.notEqual(row.data?.completed_at, null);

    await u.client.rpc('set_milestone', { p_milestone_id: m2.id, p_complete: false });
    row = await admin.from('goals').select('completed_at').eq('id', goal.id).single();
    assert.equal(row.data?.completed_at, null);

    // Re-completing on a later day would pass the ledger key; the function must not.
    await admin.from('point_ledger').update({ date: utcDay(-1) }).eq('user_id', u.id);
    await u.client.rpc('set_milestone', { p_milestone_id: m2.id, p_complete: true });
    assert.equal(await total(u.id), 100);
  });
});

describe('the write paths act only on the caller’s own rows', () => {
  it('A cannot complete, roll, log or tick anything of B’s', async () => {
    const a = await createUser('fa');
    const b = await createUser('fb');
    const bAction = await action(b, 'B’s');
    await action(b, 'B’s other');
    const bChallenge = await seed<{ id: string }>('daily_challenges', {
      user_id: b.id, action_id: bAction, date: utcDay(),
    });
    const bHabit = await habit(b, 'build');
    const bGoal = await seed<{ id: string }>('goals', {
      user_id: b.id, title: 'B', start_date: utcDay(), target_date: utcDay(1),
    });
    const bMilestone = await seed<{ id: string }>('milestones', { goal_id: bGoal.id, user_id: b.id, title: 'm' });

    const attempts = [
      [await a.client.rpc('complete_challenge', { p_challenge_id: bChallenge.id }), /challenge_not_found/],
      [await a.client.rpc('roll_challenge', { p_challenge_id: bChallenge.id }), /challenge_not_found/],
      [await a.client.rpc('log_habit', { p_habit_id: bHabit.id, p_completed: true }), /habit_not_found/],
      [await a.client.rpc('set_milestone', { p_milestone_id: bMilestone.id, p_complete: true }), /milestone_not_found/],
    ] as const;
    for (const [result, pattern] of attempts) assert.match(result.error?.message ?? '', pattern);

    assert.equal(await total(a.id), 0);
    assert.equal(await total(b.id), 0);
    const { data } = await admin.from('daily_challenges').select('roll_count, completed_at').eq('id', bChallenge.id).single();
    assert.deepEqual(data, { roll_count: 0, completed_at: null });
    const logs = await admin.from('habit_logs').select('id').eq('habit_id', bHabit.id);
    assert.equal(logs.data?.length, 0);
  });

  it('a signed-out caller reaches none of them', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const id = '00000000-0000-0000-0000-000000000000';
    for (const [fn, args] of [
      ['ensure_daily_challenge', {}],
      ['complete_challenge', { p_challenge_id: id }],
      ['roll_challenge', { p_challenge_id: id }],
      ['log_habit', { p_habit_id: id, p_completed: true }],
      ['set_milestone', { p_milestone_id: id, p_complete: true }],
    ] as const) {
      const { error } = await anon.rpc(fn, args);
      assert.equal(error?.code, RLS_DENIED, fn);
    }
  });
});
