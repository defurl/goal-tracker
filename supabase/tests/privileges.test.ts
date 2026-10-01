// 026_least_privilege.sql — every role holds only the table privileges it uses.
//
// RLS decides whose rows a statement reaches; these grants decide which verbs
// and which columns it may use at all. Three layers, so the gate cannot pass
// by accident:
//
//   1. The catalog: the exact matrix of table, column and function privileges
//      for anon, authenticated, service_role and PUBLIC — and what a table, a
//      sequence and a function created after 026 receive by default.
//   2. Every write the app makes, in the app's own shape, through a signed-in
//      client. A grant too narrow for the product fails here, not in a room.
//   3. Writes the app never makes — server-owned columns, deletes — refused
//      with 42501, and the row read back unchanged.
//
// A new table, column or function changes the matrix below on purpose: the
// migration that adds it says who may use it, and this file says it again.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { admin, anonKey, catalog, createUser, deleteUsers, RLS_DENIED, seed, url, USER_TABLES } from './harness.ts';

after(deleteUsers);

type Row = Record<string, unknown>;

const DAY = '2026-01-01';
const TABLES = Object.keys(USER_TABLES).sort();
const ROLES = ['anon', 'authenticated', 'public', 'service_role'];

// ── the matrix ─────────────────────────────────────────────────────────────
// Each write is listed where the app makes it, and through which client.

/** The columns authenticated may write. A table not listed: none. */
const WRITES: Record<string, { insert?: string[]; update?: string[] }> = {
  // lib/data/hydrate.ts, browser: the zone over the UTC default
  profiles: { update: ['timezone'] },
  // lib/agents/extract.ts, the server's user client
  user_actions: { insert: ['action_text', 'prompt_version', 'source_summary', 'source_url', 'user_id'] },
  // lib/data/habits.ts createHabit and archiveHabit, browser
  habits: { insert: ['frequency', 'name', 'type', 'user_id'], update: ['archived_at'] },
  // lib/data/journal.ts saveEntry (browser) and lib/agents/reflect.ts (server's
  // user client). The upsert's DO UPDATE sets its conflict key too.
  journal_entries: {
    insert: ['date', 'mood', 'mood_score', 'tags', 'user_id'],
    update: [
      'ai_emotion', 'ai_next_action', 'ai_strength', 'ai_summary', 'date', 'mood', 'mood_score',
      'prompt_version', 'tags', 'user_id',
    ],
  },
  // lib/data/goals.ts createGoal, browser
  goals: { insert: ['category', 'description', 'start_date', 'target_date', 'title', 'user_id'] },
  milestones: { insert: ['goal_id', 'sort_order', 'title', 'user_id'] },
};

/** Not even readable by its owner: 011 and 012 give it no user path. */
const UNREADABLE = ['rate_limits'];

/** What a signed-in browser may call (019–021). */
const USER_RPCS = ['complete_challenge', 'ensure_daily_challenge', 'log_habit', 'roll_challenge', 'set_milestone'];

const CRUD = ['DELETE', 'INSERT', 'SELECT', 'UPDATE'];

/** Every table privilege there is; MAINTAIN only exists from Postgres 17. */
const PRIVILEGES = `array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']
  || case when current_setting('server_version_num')::int >= 170000
          then array['MAINTAIN'] else array[]::text[] end`;

interface Held {
  table: string;
  role: string;
  privileges: string[];
  insert: string[];
  update: string[];
  columns: string[];
}

function held(): Held[] {
  const columns = (privilege: string) => `(
    select coalesce(json_agg(a.attname order by a.attname), '[]') from pg_attribute a
    where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      and has_column_privilege(r.role, c.oid, a.attnum, '${privilege}'))`;
  return catalog<Held[]>(`
    select json_agg(json_build_object(
      'table', c.relname,
      'role', r.role,
      'privileges', (select coalesce(json_agg(p order by p), '[]') from unnest(${PRIVILEGES}) p
                     where has_table_privilege(r.role, c.oid, p)),
      'insert', ${columns('INSERT')},
      'update', ${columns('UPDATE')},
      'columns', (select json_agg(a.attname order by a.attname) from pg_attribute a
                  where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped)
    ) order by c.relname, r.role)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    cross join unnest(array['${ROLES.join("','")}']) as r(role)
    where c.relkind in ('r', 'p', 'v', 'm', 'f');
  `);
}

function expected(table: string, role: string, columns: string[]) {
  if (role === 'service_role') return { privileges: CRUD, insert: columns, update: columns };
  if (role === 'authenticated') {
    return {
      privileges: UNREADABLE.includes(table) ? [] : ['SELECT'],
      insert: [...(WRITES[table]?.insert ?? [])].sort(),
      update: [...(WRITES[table]?.update ?? [])].sort(),
    };
  }
  return { privileges: [], insert: [], update: [] }; // anon, and PUBLIC, which anon inherits
}

describe('the catalog: who holds what — 026', () => {
  const rows = held();

  it('public holds exactly the thirteen tables, so none escapes this matrix', () => {
    assert.deepEqual([...new Set(rows.map((r) => r.table))], TABLES);
  });

  for (const role of ROLES) {
    it(`${role}: every table, every column, exactly as granted`, () => {
      for (const row of rows.filter((r) => r.role === role)) {
        const { privileges, insert, update } = row;
        assert.deepEqual(
          { privileges, insert, update },
          expected(row.table, role, row.columns),
          `${row.table} / ${role}`,
        );
      }
    });
  }

  it('functions: authenticated calls the five write paths and nothing else; anon and PUBLIC nothing', () => {
    const fns = catalog<{ name: string; role: string; execute: boolean }[]>(`
      select json_agg(json_build_object('name', p.proname, 'role', r.role,
                      'execute', has_function_privilege(r.role, p.oid, 'EXECUTE')))
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
      cross join unnest(array['anon', 'authenticated', 'public']) as r(role);
    `);
    const callable = (role: string) => fns.filter((f) => f.role === role && f.execute).map((f) => f.name).sort();
    assert.deepEqual(callable('authenticated'), USER_RPCS);
    assert.deepEqual(callable('anon'), []);
    assert.deepEqual(callable('public'), []);
  });

  it('a table, a sequence and a function created after 026 arrive closed', () => {
    const probe = catalog<{ role: string; table: string[]; sequence: string[]; execute: boolean }[]>(`
      begin;
      create table public.__privileges_probe (id int);
      create sequence public.__privileges_probe_seq;
      create function public.__privileges_probe_fn() returns int language sql as 'select 1';
      select json_agg(json_build_object(
        'role', r.role,
        'table', (select coalesce(json_agg(p order by p), '[]') from unnest(${PRIVILEGES}) p
                  where has_table_privilege(r.role, 'public.__privileges_probe'::regclass, p)),
        'sequence', (select coalesce(json_agg(p order by p), '[]') from unnest(array['SELECT','UPDATE','USAGE']) p
                     where has_sequence_privilege(r.role, 'public.__privileges_probe_seq'::regclass, p)),
        'execute', has_function_privilege(r.role, 'public.__privileges_probe_fn()'::regprocedure, 'EXECUTE')
      ) order by r.role)
      from unnest(array['${ROLES.join("','")}']) as r(role);
      rollback;
    `);
    const closed = { table: [], sequence: [], execute: false };
    assert.deepEqual(probe, [
      { role: 'anon', ...closed },
      { role: 'authenticated', ...closed },
      { role: 'public', ...closed },
      { role: 'service_role', table: CRUD, sequence: ['SELECT', 'UPDATE', 'USAGE'], execute: true },
    ]);
  });
});

describe('a signed-out visitor reaches no table — 026', () => {
  it('every read is refused outright, not answered with an empty list', async () => {
    const anon = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const table of TABLES) {
      const { data, error } = await anon.from(table).select().limit(1);
      assert.equal(error?.code, RLS_DENIED, `${table}: anon read answered ${JSON.stringify(data)}`);
    }
  });
});

// ── every write the app makes, in its own shape ─────────────────────────────
// user_actions (lib/agents/extract.ts) and the reflection's ai_* update
// (lib/agents/reflect.ts) are the agents' own code, run for real against this
// database in extract.test.ts and reflect.test.ts. The browser's writes cannot
// be imported into node, so each is repeated here with its source named.

describe('every write the app makes still works — 026', () => {
  it('hydrate() records the browser\'s zone (lib/data/hydrate.ts)', async () => {
    const u = await createUser('grant-zone');
    const { error } = await u.client.from('profiles').update({ timezone: 'Asia/Ho_Chi_Minh' }).eq('id', u.id);
    assert.equal(error, null);
    const { data } = await admin.from('profiles').select('timezone').eq('id', u.id).single();
    assert.equal(data?.timezone, 'Asia/Ho_Chi_Minh');
  });

  it('createHabit() and archiveHabit() (lib/data/habits.ts)', async () => {
    const u = await createUser('grant-habit');
    const created = await u.client.from('habits').insert({
      user_id: u.id, name: 'Read', type: 'build', frequency: { days: [1, 3, 5] },
    });
    assert.equal(created.error, null);
    const { data: habit } = await admin.from('habits').select('id, frequency').eq('user_id', u.id).single();
    assert.deepEqual(habit?.frequency, { days: [1, 3, 5] });

    const archived = await u.client.from('habits')
      .update({ archived_at: new Date().toISOString() }).eq('id', habit?.id).eq('user_id', u.id);
    assert.equal(archived.error, null);
    const { data } = await admin.from('habits').select('archived_at').eq('id', habit?.id).single();
    assert.notEqual(data?.archived_at, null);
  });

  it('saveEntry() twice in a day, the second through the upsert\'s update (lib/data/journal.ts)', async () => {
    const u = await createUser('grant-journal');
    for (const entry of [
      { mood: 'calm', mood_score: 1, tags: ['rest'] },
      { mood: 'low', mood_score: -1, tags: ['work'] },
    ]) {
      const { error } = await u.client.from('journal_entries')
        .upsert({ user_id: u.id, date: DAY, ...entry }, { onConflict: 'user_id,date' });
      assert.equal(error, null);
    }
    const { data } = await admin.from('journal_entries').select('mood, mood_score, tags').eq('user_id', u.id);
    assert.deepEqual(data, [{ mood: 'low', mood_score: -1, tags: ['work'] }]);
  });

  it('createGoal() and its milestones (lib/data/goals.ts)', async () => {
    const u = await createUser('grant-goal');
    const { data: goal, error } = await u.client.from('goals').insert({
      user_id: u.id, title: 'Swim a length', category: 'health', description: 'Twice a week.',
      start_date: DAY, target_date: '2026-06-01',
    }).select('id').single();
    assert.equal(error, null);

    const milestones = await u.client.from('milestones').insert(
      ['Float', 'Kick across'].map((title, i) => ({ goal_id: goal?.id, user_id: u.id, title, sort_order: i })),
    );
    assert.equal(milestones.error, null);
    const { data } = await admin.from('milestones').select('title, sort_order').eq('goal_id', goal?.id).order('sort_order');
    assert.deepEqual(data, [{ title: 'Float', sort_order: 0 }, { title: 'Kick across', sort_order: 1 }]);
  });
});

// ── what the app never writes ───────────────────────────────────────────────

async function adminRow(table: string, id: unknown): Promise<Row | null> {
  const { data, error } = await admin.from(table).select().eq('id', id).maybeSingle<Row>();
  if (error) throw new Error(`admin read ${table}: ${error.message}`);
  return data;
}

describe('a column the app never writes cannot be written — 026', () => {
  it('habits: a streak, a type, a name or a birthday are the server\'s, and a new habit starts active', async () => {
    const u = await createUser('mass-habit');
    for (const extra of [{ streak: 99 }, { longest_streak: 99 }, { archived_at: new Date().toISOString() }]) {
      const { error } = await u.client.from('habits').insert({ user_id: u.id, name: 'Run', type: 'build', ...extra });
      assert.equal(error?.code, RLS_DENIED, `a habit was created with ${Object.keys(extra)}`);
    }

    const habit = await seed<Row>('habits', { user_id: u.id, name: 'Run', type: 'build' });
    for (const patch of [
      { streak: 99 }, { longest_streak: 99 }, { type: 'break' }, { name: 'Renamed' },
      { created_at: '2020-01-01T00:00:00Z' }, { frequency: { days: [] } },
    ]) {
      const { error } = await u.client.from('habits').update(patch).eq('id', habit.id);
      assert.equal(error?.code, RLS_DENIED, `habits.${Object.keys(patch)} was writable`);
    }
    assert.deepEqual(await adminRow('habits', habit.id), habit);
  });

  it('user_actions: an action\'s status is the challenge functions\'', async () => {
    const u = await createUser('mass-action');
    const inserted = await u.client.from('user_actions').insert({
      user_id: u.id, action_text: 'Stretch.', source_summary: 's', status: 'done',
    });
    assert.equal(inserted.error?.code, RLS_DENIED, 'an action was created already done');

    const action = await seed<Row>('user_actions', { user_id: u.id, action_text: 'Stretch.', source_summary: 's', status: 'done' });
    const reopened = await u.client.from('user_actions').update({ status: 'pending' }).eq('id', action.id);
    assert.equal(reopened.error?.code, RLS_DENIED, 'a done action was set back to pending');
    assert.deepEqual(await adminRow('user_actions', action.id), action);
  });

  it('goals and milestones: completed_at is set_milestone()\'s', async () => {
    const u = await createUser('mass-goal');
    const done = new Date().toISOString();
    const goalInsert = await u.client.from('goals').insert({
      user_id: u.id, title: 'G', start_date: DAY, target_date: DAY, completed_at: done,
    });
    assert.equal(goalInsert.error?.code, RLS_DENIED, 'a goal was created already complete');

    const goal = await seed<Row>('goals', { user_id: u.id, title: 'G', start_date: DAY, target_date: DAY });
    const milestoneInsert = await u.client.from('milestones').insert({
      goal_id: goal.id, user_id: u.id, title: 'm', completed_at: done,
    });
    assert.equal(milestoneInsert.error?.code, RLS_DENIED, 'a milestone was created already complete');

    const milestone = await seed<Row>('milestones', { goal_id: goal.id, user_id: u.id, title: 'm' });
    for (const [table, row, patch] of [
      ['goals', goal, { completed_at: done }],
      ['goals', goal, { title: 'Renamed' }],
      ['milestones', milestone, { completed_at: done }],
      ['milestones', milestone, { title: 'Renamed' }],
    ] as const) {
      const { error } = await u.client.from(table).update(patch).eq('id', row.id);
      assert.equal(error?.code, RLS_DENIED, `${table}.${Object.keys(patch)} was writable`);
      assert.deepEqual(await adminRow(table, row.id), row);
    }
  });

  it('profiles and journal_entries: nothing beyond the zone, the mood and the reflection', async () => {
    const u = await createUser('mass-profile');
    const before = await adminRow('profiles', u.id);
    const created = await u.client.from('profiles').update({ created_at: '2020-01-01T00:00:00Z' }).eq('id', u.id);
    assert.equal(created.error?.code, RLS_DENIED, 'profiles.created_at was writable');
    assert.deepEqual(await adminRow('profiles', u.id), before);

    // The reflection's fields arrive by UPDATE, after the agent answers; a new
    // entry carries the user's own mood and tags only.
    for (const extra of [{ ai_summary: 'Written by the user' }, { prompt_version: '9.9' }, { created_at: '2020-01-01T00:00:00Z' }]) {
      const { error } = await u.client.from('journal_entries').insert({
        user_id: u.id, date: DAY, mood: 'calm', mood_score: 1, ...extra,
      });
      assert.equal(error?.code, RLS_DENIED, `a journal entry was created with ${Object.keys(extra)}`);
    }
  });

  it('nothing is deleted as the user: habits are archived, accounts deleted by the server (B5.2)', async () => {
    const u = await createUser('no-delete');
    const action = await seed<Row>('user_actions', { user_id: u.id, action_text: 'Walk.', source_summary: 's' });
    const habit = await seed<Row>('habits', { user_id: u.id, name: 'Walk', type: 'build' });
    const journal = await seed<Row>('journal_entries', { user_id: u.id, date: DAY, mood: 'calm', mood_score: 1 });
    const goal = await seed<Row>('goals', { user_id: u.id, title: 'G', start_date: DAY, target_date: DAY });
    const milestone = await seed<Row>('milestones', { goal_id: goal.id, user_id: u.id, title: 'm' });

    for (const [table, id] of [
      ['profiles', u.id], ['user_actions', action.id], ['habits', habit.id],
      ['journal_entries', journal.id], ['goals', goal.id], ['milestones', milestone.id],
    ] as const) {
      const { error } = await u.client.from(table).delete().eq('id', id);
      assert.equal(error?.code, RLS_DENIED, `${table}: the owner deleted a row`);
      assert.ok(await adminRow(table, id), `${table}: the row is gone`);
    }
  });
});
