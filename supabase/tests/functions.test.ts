// 013_functions.sql — the behaviour B1.4 ships, asserted rather than assumed.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { admin, createUser, deleteUsers, seed } from './harness.ts';

after(deleteUsers);

const DAY = '2026-01-01';

async function total(userId: string): Promise<number> {
  const { data } = await admin.from('glow_points').select('total').eq('user_id', userId);
  return (data?.[0]?.total as number | undefined) ?? 0;
}

describe('handle_new_user()', () => {
  it('gives every new user a profile, at UTC until the client says otherwise', async () => {
    const u = await createUser('profile');
    const { data } = await admin.from('profiles').select().eq('id', u.id).single();
    assert.equal(data?.timezone, 'UTC');
  });
});

describe('enforce_habit_cap() — FR-2.1', () => {
  it('refuses an eleventh active habit, and an archived one frees its slot', async () => {
    const u = await createUser('habits');
    for (let i = 0; i < 10; i++) {
      const { error } = await u.client
        .from('habits').insert({ user_id: u.id, name: `habit ${i}`, type: 'build' });
      assert.equal(error, null, `habit ${i}: ${error?.message}`);
    }

    const eleventh = await u.client
      .from('habits').insert({ user_id: u.id, name: 'one too many', type: 'build' });
    assert.match(eleventh.error?.message ?? '', /habit_cap_reached/);

    const { data: first } = await u.client.from('habits').select('id').limit(1).single();
    await u.client.from('habits')
      .update({ archived_at: new Date().toISOString() }).eq('id', first?.id);
    const afterArchive = await u.client
      .from('habits').insert({ user_id: u.id, name: 'replacement', type: 'break' });
    assert.equal(afterArchive.error, null);
  });
});

describe('enforce_milestone_cap() — FR-4.2', () => {
  it('refuses a sixth milestone on one goal', async () => {
    const u = await createUser('milestones');
    const { data: goal } = await u.client.from('goals').insert({
      user_id: u.id, title: 'Learn Go', start_date: DAY, target_date: '2026-12-31',
    }).select().single();

    for (let i = 0; i < 5; i++) {
      const { error } = await u.client
        .from('milestones').insert({ goal_id: goal?.id, user_id: u.id, title: `m${i}` });
      assert.equal(error, null, `milestone ${i}: ${error?.message}`);
    }
    const sixth = await u.client
      .from('milestones').insert({ goal_id: goal?.id, user_id: u.id, title: 'm5' });
    assert.match(sixth.error?.message ?? '', /milestone_cap_reached/);
  });
});

describe('award_points() — the ledger', () => {
  it('awards once per (event, ref, date): a repeat is a no-op, not a second award', async () => {
    const u = await createUser('points');
    const ref = randomUUID();
    const award = { p_user_id: u.id, p_event: 'build_habit', p_points: 10, p_ref_id: ref, p_date: DAY };

    assert.equal((await admin.rpc('award_points', award)).error, null);
    assert.equal((await admin.rpc('award_points', award)).error, null);
    assert.equal(await total(u.id), 10);

    await admin.rpc('award_points', { ...award, p_ref_id: randomUUID() });
    assert.equal(await total(u.id), 20);

    const { data: rows } = await admin.from('point_ledger').select().eq('user_id', u.id);
    assert.equal(rows?.length, 2);
  });

  it('D-08: refuses zero or negative points, and a negative habit award', async () => {
    const u = await createUser('negative');
    const { error } = await admin.rpc('award_points', {
      p_user_id: u.id, p_event: 'break_habit', p_points: -5, p_ref_id: randomUUID(), p_date: DAY,
    });
    assert.ok(error, 'a negative award was accepted');
    assert.equal(await total(u.id), 0);

    const habit = await seed<{ id: string }>('habits', { user_id: u.id, name: 'Smoke', type: 'break' });
    const log = await admin.from('habit_logs').insert({
      habit_id: habit.id, user_id: u.id, date: DAY, completed: false, points_awarded: -5,
    });
    assert.equal(log.error?.code, '23514', 'check (points_awarded >= 0) did not fire');
  });
});

describe('seed_daily_challenge() — FR-1.4', () => {
  function localDate(timeZone: string): string {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
  }

  it('seeds one challenge on the user\'s LOCAL date, and a re-run adds nothing', async () => {
    const u = await createUser('seeded');
    // UTC+14: the local date differs from UTC's for ten hours of every day.
    await admin.from('profiles').update({ timezone: 'Pacific/Kiritimati' }).eq('id', u.id);
    await seed('user_actions', { user_id: u.id, action_text: 'Stretch.', source_summary: 's' });

    assert.equal((await admin.rpc('seed_daily_challenge')).error, null);
    assert.equal((await admin.rpc('seed_daily_challenge')).error, null);

    const { data } = await admin.from('daily_challenges').select().eq('user_id', u.id);
    assert.equal(data?.length, 1);
    assert.equal(data?.[0]?.date, localDate('Pacific/Kiritimati'));
  });

  it('skips a user with no pending actions — FR-1.7 empty state, not an error', async () => {
    const u = await createUser('empty');
    await seed('user_actions', {
      user_id: u.id, action_text: 'Already done.', source_summary: 's', status: 'done',
    });
    assert.equal((await admin.rpc('seed_daily_challenge')).error, null);
    const { data } = await admin.from('daily_challenges').select().eq('user_id', u.id);
    assert.equal(data?.length, 0);
  });
});

describe('owner decisions 2026-09-24 — 015 and 016', () => {
  it('an award with no ref is still awarded once per day (015, nulls not distinct)', async () => {
    const u = await createUser('perfect-day');
    const award = { p_user_id: u.id, p_event: 'perfect_day', p_points: 25, p_ref_id: null, p_date: DAY };
    assert.equal((await admin.rpc('award_points', award)).error, null);
    assert.equal((await admin.rpc('award_points', award)).error, null);
    assert.equal(await total(u.id), 25);
  });

  async function nineActiveHabits() {
    const u = await createUser('race');
    const rows = Array.from({ length: 9 }, (_, i) => ({ user_id: u.id, name: `h${i}`, type: 'build' }));
    const { error } = await admin.from('habits').insert(rows);
    assert.equal(error, null);
    return u;
  }

  async function activeCount(userId: string): Promise<number> {
    const { count } = await admin.from('habits').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).is('archived_at', null);
    return count ?? -1;
  }

  it('concurrent inserts at nine: exactly one gets the tenth slot (016)', async () => {
    const u = await nineActiveHabits();
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        u.client.from('habits').insert({ user_id: u.id, name: `racer ${i}`, type: 'build' })),
    );
    assert.equal(results.filter((r) => r.error === null).length, 1);
    assert.equal(await activeCount(u.id), 10);
  });

  it('un-archiving a habit respects the cap (016)', async () => {
    const u = await nineActiveHabits();
    const { data: old } = await u.client.from('habits')
      .insert({ user_id: u.id, name: 'old', type: 'build', archived_at: new Date().toISOString() })
      .select().single();
    await u.client.from('habits').insert({ user_id: u.id, name: 'tenth', type: 'build' });

    const revived = await u.client.from('habits').update({ archived_at: null }).eq('id', old?.id);
    assert.match(revived.error?.message ?? '', /habit_cap_reached/);
    assert.equal(await activeCount(u.id), 10);
  });
});
