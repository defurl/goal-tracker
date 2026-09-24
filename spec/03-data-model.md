# 03 — Data Model

> Status: **LOCKED.** Supabase / PostgreSQL. Every table is RLS-protected and
> scoped to `auth.uid()`. There is no application-level path to another user's
> data because there is no database-level path to it.
>
> Two rules from `01-decisions.md` are enforced **in the schema**, not in
> application code, because application code drifts:
> - **D-08** — no negative points. `CHECK (points_awarded >= 0)`.
> - **FR-3.6** — journal text is never persisted. `journal_entries` has no
>   column able to hold it.

---

## 1. Migration order

Run in this order; each depends on the previous.

```
001_profiles.sql          -- timezone, needed by the local-midnight seeder
002_user_actions.sql
003_daily_challenges.sql
004_habits.sql
005_habit_logs.sql
006_glow_points.sql       -- ledger + materialised total
007_journal_entries.sql
008_goals.sql
009_milestones.sql
010_agent_logs.sql
011_rate_limits.sql
012_rls_policies.sql      -- all policies together, so they are reviewable as a set
013_functions.sql         -- award_points(), seed_daily_challenge()
```

Keeping RLS in one migration is deliberate: a reviewer can read every policy in
the product on one screen, which is the only way this stays auditable.

---

## 2. Core tables

### profiles

Extends `auth.users`. Exists chiefly to hold the timezone that FR-1.4 needs.

```sql
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  timezone    text not null default 'UTC',   -- IANA, e.g. 'Asia/Ho_Chi_Minh'
  created_at  timestamptz not null default now()
);
```

> `timezone` is why the daily seeder is an hourly sweep rather than a single
> 00:00 UTC cron. See `04-ai-agents.md` §4.

### user_actions

The library of extracted micro-actions.

```sql
create type action_status as enum ('pending','active','done','skipped');

create table user_actions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  action_text     text not null check (length(action_text) <= 300),
  source_url      text,
  source_summary  text not null check (length(source_summary) <= 500),
  status          action_status not null default 'pending',
  created_at      timestamptz not null default now()
);

create index on user_actions (user_id, status);
```

The `(user_id, status)` index matters — the seeder queries exactly that pair
for every user, every hour.

### daily_challenges

One row per user per day.

```sql
create table daily_challenges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  action_id     uuid not null references user_actions(id) on delete cascade,
  date          date not null,              -- the user's LOCAL date
  roll_count    int  not null default 0 check (roll_count >= 0),
  completed_at  timestamptz,
  unique (user_id, date)
);
```

The `unique (user_id, date)` constraint is what makes the hourly sweep safe to
run repeatedly — a second attempt for the same local day is a no-op conflict
rather than a duplicate challenge.

### habits

```sql
create type habit_type as enum ('build','break');

create table habits (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null check (length(name) between 1 and 80),
  type            habit_type not null,
  frequency       jsonb not null default '{"days":[0,1,2,3,4,5,6]}'::jsonb,
  reminder_time   time,                     -- stored; nothing sends in Phase 1
  streak          int not null default 0 check (streak >= 0),
  longest_streak  int not null default 0 check (longest_streak >= 0),
  archived_at     timestamptz,
  created_at      timestamptz not null default now()
);
```

FR-2.1 caps active habits at 10. Enforce it in `013_functions.sql` with a
trigger, not only in the client:

```sql
create or replace function enforce_habit_cap() returns trigger as $$
begin
  if (select count(*) from habits
      where user_id = new.user_id and archived_at is null) >= 10 then
    raise exception 'habit_cap_reached';
  end if;
  return new;
end $$ language plpgsql;

create trigger habits_cap before insert on habits
  for each row execute function enforce_habit_cap();
```

`archived_at` rather than deletion: deleting a habit would orphan its logs and
silently rewrite the user's history, which the wall grid displays.

### habit_logs

```sql
create table habit_logs (
  id              uuid primary key default gen_random_uuid(),
  habit_id        uuid not null references habits(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  date            date not null,            -- user's LOCAL date
  completed       boolean not null,
  points_awarded  int not null default 0 check (points_awarded >= 0),
  created_at      timestamptz not null default now(),
  unique (habit_id, date)
);

create index on habit_logs (user_id, date);
```

> **`check (points_awarded >= 0)` is decision D-08 made structural.** The SRS
> specified −5 points for a relapse. That is removed, and the schema will reject
> it if anyone reintroduces it.

`user_id` is denormalised onto this table deliberately — RLS policies that have
to join to `habits` to find the owner are both slower and easier to get wrong.

---

## 3. journal_entries — the privacy-critical table

```sql
create table journal_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null,
  mood          text not null,              -- emoji key, e.g. 'calm'
  mood_score    smallint not null check (mood_score between -2 and 2),
  tags          text[] not null default '{}',
  ai_summary    text check (length(ai_summary) <= 600),
  ai_emotion    text check (length(ai_emotion) <= 40),
  ai_strength   text check (length(ai_strength) <= 200),
  ai_next_action text check (length(ai_next_action) <= 200),
  created_at    timestamptz not null default now(),
  unique (user_id, date)
);
```

**There is deliberately no `entry_text` column, and adding one is a breach of
FR-3.6.** Raw text exists only in the request body, in memory, for the duration
of the agent call. It is never written to this table, never logged, never
included in `agent_logs`, and never sent to any analytics sink.

A reviewer checking this promise should be able to confirm it by reading the
`create table` statement alone. That is the point of enforcing it here.

`mood_score` is stored separately from `mood` so the calendar colouring
(FR-3.5) does not have to map emoji to sentiment at render time.

---

## 4. Points: ledger + materialised total

The SRS had a single `glow_points` row per user with `total` and `today`. That
cannot answer "why do I have 340 points?" and it makes every award a read-modify-write
race. Use an append-only ledger with a materialised total instead.

```sql
create type point_event as enum (
  'build_habit','break_habit','perfect_day','daily_challenge',
  'weekly_streak','goal_complete'
);

create table point_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  event       point_event not null,
  points      int not null check (points > 0),
  ref_id      uuid,                          -- habit_log / challenge / goal id
  date        date not null,                 -- user's LOCAL date
  created_at  timestamptz not null default now(),
  unique (user_id, event, ref_id, date)      -- idempotency
);

create table glow_points (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  total    int not null default 0 check (total >= 0),
  updated_at timestamptz not null default now()
);
```

The `unique (user_id, event, ref_id, date)` constraint is what makes
AC-2.3 ("does not award it twice") and AC-4.2 true by construction rather than
by careful application code.

### The ledger

| Event | Points | Notes |
|---|---|---|
| Complete a build habit | **+10** | per habit, per day |
| Avoid a break habit | **+15** | higher — harder behaviour change |
| Perfect Day (≥ 80 % of *due* habits) | **+25** | once per day |
| Complete Daily Challenge | **+30** | F1 |
| 7-day streak | **+50** | once per habit per streak milestone |
| Complete all milestones of a goal | **+100** | F4 |
| ~~Relapse on a break habit~~ | ~~−5~~ | **Removed.** `01-decisions.md` D-08. |

Awards happen in one place — a `security definer` function, so the client can
never write its own score (X-6):

```sql
create or replace function award_points(
  p_user_id uuid, p_event point_event, p_points int,
  p_ref_id uuid, p_date date
) returns void
language plpgsql security definer as $$
begin
  insert into point_ledger (user_id, event, points, ref_id, date)
  values (p_user_id, p_event, p_points, p_ref_id, p_date)
  on conflict do nothing;             -- idempotent

  if found then
    insert into glow_points (user_id, total) values (p_user_id, p_points)
    on conflict (user_id) do update
      set total = glow_points.total + excluded.total,
          updated_at = now();
  end if;
end $$;
```

There is no "today" column. Today's points are a query:
`select coalesce(sum(points),0) from point_ledger where user_id = $1 and date = $2`.
A daily cron resetting a counter is a thing that can fail silently at 3 a.m.;
a query cannot.

---

## 5. Goals

```sql
create type goal_category as enum
  ('health','career','learning','relationships','finance','other');

create table goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null check (length(title) between 1 and 120),
  category     goal_category not null default 'other',
  description  text,
  start_date   date not null,
  target_date  date not null,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  check (target_date >= start_date)          -- AC-4.1
);

create table milestones (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references goals(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null check (length(title) between 1 and 120),
  due_date     date,
  completed_at timestamptz,
  sort_order   smallint not null default 0
);
```

FR-4.2 caps milestones at 5 per goal — same trigger pattern as the habit cap.

---

## 6. Operational tables

### agent_logs

Satisfies LOG-1. **Token counts and latency only — never input or output text.**

```sql
create table agent_logs (
  id            uuid primary key default gen_random_uuid(),
  agent_id      text not null,
  user_id       uuid references auth.users(id) on delete set null,
  model         text not null,
  input_tokens  int,
  output_tokens int,
  latency_ms    int,
  success       boolean not null,
  error_code    text,          -- a code, never a message that may echo input
  created_at    timestamptz not null default now()
);

create index on agent_logs (user_id, agent_id, created_at desc);
```

> `error_code` is a code, not a message. Provider error messages sometimes quote
> the offending input back, which for `journal_analysis_agent` would persist the
> exact text FR-3.6 forbids storing. Map provider errors to a fixed enum of codes
> before they reach this table.

### rate_limits

Enforces RATE-1 server-side.

```sql
create table rate_limits (
  user_id   uuid not null references auth.users(id) on delete cascade,
  agent_id  text not null,
  date      date not null,
  count     int  not null default 0 check (count >= 0),
  primary key (user_id, agent_id, date)
);
```

Increment and check in one statement so concurrent requests cannot both pass:

```sql
insert into rate_limits (user_id, agent_id, date, count)
values ($1, $2, $3, 1)
on conflict (user_id, agent_id, date)
  do update set count = rate_limits.count + 1
returning count;
```

If the returned count exceeds the agent's cap, return 429 with `Retry-After`
and do not call the provider.

---

## 7. RLS policies

**Enable RLS on every table. No exceptions — a table without RLS in this
project is a bug, not an optimisation.**

```sql
alter table profiles          enable row level security;
alter table user_actions      enable row level security;
alter table daily_challenges  enable row level security;
alter table habits            enable row level security;
alter table habit_logs        enable row level security;
alter table point_ledger      enable row level security;
alter table glow_points       enable row level security;
alter table journal_entries   enable row level security;
alter table goals             enable row level security;
alter table milestones        enable row level security;
alter table agent_logs        enable row level security;
alter table rate_limits       enable row level security;

-- Owner-scoped full access
create policy own_profile      on profiles         for all using (id = auth.uid());
create policy own_actions      on user_actions     for all using (user_id = auth.uid());
create policy own_challenges   on daily_challenges for all using (user_id = auth.uid());
create policy own_habits       on habits           for all using (user_id = auth.uid());
create policy own_habit_logs   on habit_logs       for all using (user_id = auth.uid());
create policy own_journal      on journal_entries  for all using (user_id = auth.uid());
create policy own_goals        on goals            for all using (user_id = auth.uid());
create policy own_milestones   on milestones       for all using (user_id = auth.uid());

-- Read-only to the user; written only by security-definer functions / service role
create policy read_own_ledger  on point_ledger for select using (user_id = auth.uid());
create policy read_own_points  on glow_points  for select using (user_id = auth.uid());
create policy read_own_logs    on agent_logs   for select using (user_id = auth.uid());

-- rate_limits: service role only. No user-facing policy at all.
```

Three tables are deliberately read-only to the user. `point_ledger` and
`glow_points` are written only through `award_points()` — this is requirement
X-6 ("points are awarded server-side only") made structural. `rate_limits` gets
no user policy whatsoever, because a user who can write their own rate-limit row
has no rate limit.

### Verification gate

Phase 2 does not pass until this test does: authenticate as user A, attempt to
read and to write every table as user B, and assert that all 24 attempts fail.
Write it as a test, not a manual check — it is the kind of thing that silently
regresses when someone adds a policy for a new feature.

> **Amendment, 2026-09-24 (owner decision): a child row must share its parent's
> owner.** The policies above check the child's `user_id` only, and §2's plain
> foreign keys let user A store a row in A's own name that points at B's parent
> — a `habit_log` on B's habit, a milestone on B's goal, a challenge on B's
> action. Nothing of B's is read or changed, so the 24 attempts above still
> fail, but server code trusting the parent id would act on B's data. The owner
> ruled it a fault. `014_parent_ownership.sql` replaces the three foreign keys
> with composite ones — `(habit_id, user_id) references habits (id, user_id)`
> and likewise for goals and actions — so a mismatched owner cannot be stored,
> including by the service role. Asserted in `supabase/tests/isolation.test.ts`.
> The policies themselves are unchanged and still live in 012 alone.
>
> Noted alongside, not a new decision: `013_functions.sql` revokes EXECUTE on
> `award_points()` and `seed_daily_challenge()` from `anon` and `authenticated`.
> Supabase grants it to both by default, which would make §4's "the client can
> never write its own score" false. Do not remove the revokes.

---

## 8. Generated types

Generate TypeScript types from the live schema rather than hand-writing them:

```
pnpm supabase gen types typescript --local > lib/supabase/database.types.ts
```

Commit the output and regenerate on every migration. A hand-maintained mirror
of a database schema drifts, and the drift shows up as a runtime error in
production rather than a type error in CI.
