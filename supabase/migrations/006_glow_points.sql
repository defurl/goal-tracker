-- 006 · point_ledger + glow_points — spec/03-data-model.md §4
--
-- An append-only ledger with a materialised total, not the SRS's single row
-- with total/today: that could not answer "why do I have 340 points?" and made
-- every award a read-modify-write race.
--
-- Both are SELECT-only to the user (012). They are written only through
-- award_points() in 013 — X-6, points are awarded server-side only.
--
-- There is no "today" column. Today's points are a query over the ledger; a
-- daily cron resetting a counter is a thing that fails silently at 3 a.m.

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
  -- Idempotency: AC-2.3 and AC-4.2 ("does not award it twice") hold by
  -- construction rather than by careful application code.
  unique (user_id, event, ref_id, date)
);

create table glow_points (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  total      int not null default 0 check (total >= 0),
  updated_at timestamptz not null default now()
);

alter table point_ledger enable row level security;
alter table glow_points  enable row level security;
