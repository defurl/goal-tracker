// THE PHASE 1 TRACK B GATE — spec/06-build-plan.md, spec/03-data-model.md §7.
//
// Authenticated as user A, attempt to read and to write every one of the 12
// tables as user B. All 24 attempts must fail.
//
// "Write" is taken at its widest: inserting a row in B's name, updating one of
// B's rows and deleting one of B's rows. A write attempt fails only if all three
// do — an RLS policy that stops inserts but lets updates through is still a
// breach. Every refusal is confirmed from the service-role side too, because an
// update that "returns nothing" proves nothing until B's row is read back
// unchanged.
//
// Inserts must be refused for the RIGHT reason. Each insert payload is a valid
// row, so a check constraint or a missing column cannot masquerade as
// isolation: the test asserts the RLS error code, not merely an error.
//
// This is the kind of thing that silently regresses when someone adds a policy
// for a new feature. It runs in CI against a fresh `supabase start`.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { admin, createUser, deleteUsers, RLS_DENIED, seed, type TestUser } from './harness.ts';

type Row = Record<string, unknown>;

interface Target {
  table: string;
  /** Column holding the owning user's id. */
  owner: string;
  /** Identifies B's seeded row. */
  key: Row;
  /** A fresh, otherwise-valid row in B's name. */
  insert: Row;
  /** An update A should not be able to make to B's row. */
  patch: Row;
}

const DAY = '2026-01-01';
const NEXT_DAY = '2026-01-02';

let a: TestUser;
let b: TestUser;
const targets: Target[] = [];

before(async () => {
  a = await createUser('a');
  b = await createUser('b');

  // One row of B's in every table. The profile comes from the signup trigger.
  const action = await seed<Row>('user_actions', {
    user_id: b.id, action_text: 'Drink a glass of water.', source_summary: 'hydration',
  });
  const challenge = await seed<Row>('daily_challenges', {
    user_id: b.id, action_id: action.id, date: DAY,
  });
  const habit = await seed<Row>('habits', { user_id: b.id, name: 'Walk', type: 'build' });
  const log = await seed<Row>('habit_logs', {
    habit_id: habit.id, user_id: b.id, date: DAY, completed: true,
  });
  const { error: awardError } = await admin.rpc('award_points', {
    p_user_id: b.id, p_event: 'build_habit', p_points: 10, p_ref_id: log.id, p_date: DAY,
  });
  if (awardError) throw new Error(`award_points: ${awardError.message}`);
  const { data: ledger } = await admin
    .from('point_ledger').select().eq('user_id', b.id).single<Row>();
  const journal = await seed<Row>('journal_entries', {
    user_id: b.id, date: DAY, mood: 'calm', mood_score: 1, ai_summary: 'B wrote this',
  });
  const goal = await seed<Row>('goals', {
    user_id: b.id, title: 'Run 5k', start_date: DAY, target_date: '2026-06-01',
  });
  const milestone = await seed<Row>('milestones', {
    goal_id: goal.id, user_id: b.id, title: 'Run 1k',
  });
  const agentLog = await seed<Row>('agent_logs', {
    agent_id: 'journal_analysis_agent', user_id: b.id, model: 'gpt-4o-mini', success: true,
  });
  await seed('rate_limits', {
    user_id: b.id, agent_id: 'journal_analysis_agent', date: DAY, count: 3,
  });

  targets.push(
    {
      table: 'profiles', owner: 'id', key: { id: b.id },
      insert: { id: b.id, timezone: 'UTC' },
      patch: { timezone: 'Pacific/Kiritimati' },
    },
    {
      table: 'user_actions', owner: 'user_id', key: { id: action.id },
      insert: { user_id: b.id, action_text: 'Planted by A.', source_summary: 'A' },
      patch: { status: 'done' },
    },
    {
      table: 'daily_challenges', owner: 'user_id', key: { id: challenge.id },
      insert: { user_id: b.id, action_id: action.id, date: NEXT_DAY },
      patch: { roll_count: 3 },
    },
    {
      table: 'habits', owner: 'user_id', key: { id: habit.id },
      insert: { user_id: b.id, name: 'Planted by A', type: 'build' },
      patch: { name: 'Renamed by A' },
    },
    {
      table: 'habit_logs', owner: 'user_id', key: { id: log.id },
      insert: { habit_id: habit.id, user_id: b.id, date: NEXT_DAY, completed: true },
      patch: { completed: false },
    },
    {
      table: 'point_ledger', owner: 'user_id', key: { id: ledger?.id },
      insert: {
        user_id: b.id, event: 'build_habit', points: 10, ref_id: randomUUID(), date: NEXT_DAY,
      },
      patch: { points: 9999 },
    },
    {
      table: 'glow_points', owner: 'user_id', key: { user_id: b.id },
      insert: { user_id: b.id, total: 9999 },
      patch: { total: 9999 },
    },
    {
      table: 'journal_entries', owner: 'user_id', key: { id: journal.id },
      insert: { user_id: b.id, date: NEXT_DAY, mood: 'calm', mood_score: 0 },
      patch: { ai_summary: 'Rewritten by A' },
    },
    {
      table: 'goals', owner: 'user_id', key: { id: goal.id },
      insert: { user_id: b.id, title: 'Planted by A', start_date: DAY, target_date: DAY },
      patch: { title: 'Renamed by A' },
    },
    {
      table: 'milestones', owner: 'user_id', key: { id: milestone.id },
      insert: { goal_id: goal.id, user_id: b.id, title: 'Planted by A' },
      patch: { title: 'Renamed by A' },
    },
    {
      table: 'agent_logs', owner: 'user_id', key: { id: agentLog.id },
      insert: { agent_id: 'x', user_id: b.id, model: 'x', success: true },
      patch: { success: false },
    },
    {
      table: 'rate_limits', owner: 'user_id',
      key: { user_id: b.id, agent_id: 'journal_analysis_agent', date: DAY },
      insert: { user_id: b.id, agent_id: 'content_extraction_agent', date: DAY, count: 0 },
      // Resetting your own counter is the attack this table exists to stop.
      patch: { count: 0 },
    },
  );
});

after(deleteUsers);

async function adminRead(t: Target): Promise<Row | null> {
  const { data, error } = await admin.from(t.table).select().match(t.key).maybeSingle<Row>();
  if (error) throw new Error(`admin read ${t.table}: ${error.message}`);
  return data;
}

// A control, so the gate cannot pass by accident. If A's session were broken,
// every read below would come back empty and "pass". A must see its own row.
it('control: A is signed in and can read its own profile', async () => {
  const { data, error } = await a.client.from('profiles').select().eq('id', a.id);
  assert.equal(error, null);
  assert.equal(data?.length, 1, 'A cannot see its own profile — the session is not live');
});

const TABLES = [
  'profiles', 'user_actions', 'daily_challenges', 'habits', 'habit_logs', 'point_ledger',
  'glow_points', 'journal_entries', 'goals', 'milestones', 'agent_logs', 'rate_limits',
] as const;

describe('cross-user isolation: A attempts every table as B', () => {
  it('covers all twelve tables', () => {
    assert.deepEqual(targets.map((t) => t.table).sort(), [...TABLES].sort());
  });

  for (const table of TABLES) {
    const target = () => {
      const t = targets.find((x) => x.table === table);
      assert.ok(t, `no target for ${table}`);
      return t;
    };

    it(`read ${table} as B fails`, async () => {
      const t = target();
      assert.ok(await adminRead(t), `B's ${table} row was never seeded`);

      const { data, error } = await a.client.from(t.table).select();
      if (error) {
        assert.equal(error.code, RLS_DENIED, `${table}: unexpected error ${error.message}`);
        return;
      }
      const leaked = (data ?? []).filter((row: Row) => row[t.owner] === b.id);
      assert.equal(leaked.length, 0, `${table}: A read ${leaked.length} of B's rows`);
    });

    it(`write ${table} as B fails`, async () => {
      const t = target();
      const before = await adminRead(t);
      assert.ok(before, `B's ${table} row was never seeded`);

      // insert in B's name — refused, and refused by RLS
      const inserted = await a.client.from(t.table).insert(t.insert).select();
      assert.ok(inserted.error, `${table}: A inserted a row in B's name`);
      assert.equal(
        inserted.error.code, RLS_DENIED,
        `${table}: insert failed, but not on RLS — ${inserted.error.message}`,
      );

      // update B's row — touches nothing
      const updated = await a.client.from(t.table).update(t.patch).match(t.key).select();
      if (updated.error) assert.equal(updated.error.code, RLS_DENIED);
      else assert.equal(updated.data?.length ?? 0, 0, `${table}: A updated B's row`);

      // delete B's row — touches nothing
      const deleted = await a.client.from(t.table).delete().match(t.key).select();
      if (deleted.error) assert.equal(deleted.error.code, RLS_DENIED);
      else assert.equal(deleted.data?.length ?? 0, 0, `${table}: A deleted B's row`);

      // and from the other side: B's row is still there, byte for byte
      assert.deepEqual(await adminRead(t), before, `${table}: B's row changed`);
    });
  }
});

describe('X-6: points are awarded server-side only', () => {
  it('A cannot call award_points() for itself', async () => {
    const { error } = await a.client.rpc('award_points', {
      p_user_id: a.id, p_event: 'goal_complete', p_points: 1000, p_ref_id: randomUUID(),
      p_date: DAY,
    });
    assert.ok(error, 'award_points() is callable from the browser');
    const { data } = await admin.from('glow_points').select().eq('user_id', a.id);
    assert.equal(data?.length ?? 0, 0, 'A awarded itself points');
  });

  it('A cannot write its own ledger row or total', async () => {
    const ledger = await a.client.from('point_ledger').insert({
      user_id: a.id, event: 'goal_complete', points: 1000, ref_id: randomUUID(), date: DAY,
    });
    assert.equal(ledger.error?.code, RLS_DENIED);
    const total = await a.client.from('glow_points').insert({ user_id: a.id, total: 1000 });
    assert.equal(total.error?.code, RLS_DENIED);
  });

  it('A cannot run the seeder', async () => {
    const { error } = await a.client.rpc('seed_daily_challenge');
    assert.ok(error, 'seed_daily_challenge() is callable from the browser');
  });
});

describe('a child row belongs to its parent\'s owner — 014_parent_ownership.sql', () => {
  // The policies check user_id only, so without 014 A could insert a row in its
  // OWN name pointing at B's parent: a habit_log on B's habit, a milestone on
  // B's goal, a challenge on B's action. Nothing of B's would be read or
  // changed, but server code trusting the parent id would act on it. The
  // composite foreign keys make that row impossible to store at all.
  const FK_VIOLATION = '23503';

  async function parentsOfB() {
    const [habit, goal, action] = await Promise.all([
      admin.from('habits').select('id').eq('user_id', b.id).limit(1).single<Row>(),
      admin.from('goals').select('id').eq('user_id', b.id).limit(1).single<Row>(),
      admin.from('user_actions').select('id').eq('user_id', b.id).limit(1).single<Row>(),
    ]);
    return { habitId: habit.data?.id, goalId: goal.data?.id, actionId: action.data?.id };
  }

  it('A cannot attach its own rows to B\'s parent rows', async () => {
    const { habitId, goalId, actionId } = await parentsOfB();
    const attempts = await Promise.all([
      a.client.from('habit_logs')
        .insert({ habit_id: habitId, user_id: a.id, date: NEXT_DAY, completed: true }),
      a.client.from('milestones').insert({ goal_id: goalId, user_id: a.id, title: 'Attached' }),
      a.client.from('daily_challenges')
        .insert({ user_id: a.id, action_id: actionId, date: NEXT_DAY }),
    ]);
    for (const { error } of attempts) assert.equal(error?.code, FK_VIOLATION);
  });

  it('holds for the service role too — it is the schema, not a policy', async () => {
    const { habitId } = await parentsOfB();
    const { error } = await admin.from('habit_logs')
      .insert({ habit_id: habitId, user_id: a.id, date: NEXT_DAY, completed: true });
    assert.equal(error?.code, FK_VIOLATION);
  });
});
