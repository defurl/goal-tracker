// B5.2 — deleting an account removes everything that belongs to it (D-24 §2).
//
// DELETE /api/account calls auth.admin.deleteUser() through the service role,
// and the schema does the rest: every user table references auth.users with
// `on delete cascade`, except agent_logs, which is `on delete set null` so the
// size-and-speed record of past AI calls survives without pointing at anyone.
// /privacy promises exactly that, so this asserts it table by table.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { admin, createUser, deleteUsers, seed, USER_TABLES } from './harness.ts';

after(deleteUsers);

const DAY = '2026-01-01';

type Row = Record<string, unknown>;

async function rowsOf(userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const [table, owner] of Object.entries(USER_TABLES)) {
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(owner, userId);
    if (error) throw new Error(`count ${table}: ${error.message}`);
    counts[table] = count ?? 0;
  }
  return counts;
}

describe('account deletion — B5.2', () => {
  it('leaves no row carrying the deleted id, and keeps agent_logs with no user', async () => {
    const u = await createUser('delete-me');

    // One row in every table. profiles and user_plans come from the signup trigger.
    const action = await seed<Row>('user_actions', {
      user_id: u.id, action_text: 'Drink a glass of water.', source_summary: 'hydration',
    });
    await seed('daily_challenges', { user_id: u.id, action_id: action.id, date: DAY });
    const habit = await seed<Row>('habits', { user_id: u.id, name: 'Walk', type: 'build' });
    const log = await seed<Row>('habit_logs', { habit_id: habit.id, user_id: u.id, date: DAY, completed: true });
    const { error: awardError } = await admin.rpc('award_points', {
      p_user_id: u.id, p_event: 'build_habit', p_points: 10, p_ref_id: log.id, p_date: DAY,
    });
    if (awardError) throw new Error(`award_points: ${awardError.message}`);
    await seed('journal_entries', { user_id: u.id, date: DAY, mood: 'calm', mood_score: 1 });
    const goal = await seed<Row>('goals', {
      user_id: u.id, title: 'Run 5k', start_date: DAY, target_date: '2026-06-01',
    });
    await seed('milestones', { goal_id: goal.id, user_id: u.id, title: 'Run 1k' });
    const agentLog = await seed<Row>('agent_logs', {
      agent_id: 'journal_analysis_agent', user_id: u.id, model: 'gemini', success: true,
    });
    await seed('rate_limits', { user_id: u.id, agent_id: 'journal_analysis_agent', date: DAY, count: 1 });

    // A control: the seeding reached every table, so an empty table below means deleted.
    const before = await rowsOf(u.id);
    for (const [table, n] of Object.entries(before)) assert.ok(n > 0, `${table} was never seeded`);

    const { error } = await admin.auth.admin.deleteUser(u.id);
    assert.equal(error, null);

    const after = await rowsOf(u.id);
    for (const [table, n] of Object.entries(after)) assert.equal(n, 0, `${table} still holds ${n} row(s)`);

    const { data: kept } = await admin.from('agent_logs').select('user_id, success').eq('id', agentLog.id).single();
    assert.deepEqual(kept, { user_id: null, success: true }, 'the AI call record is kept, pointing at no one');
  });
});
