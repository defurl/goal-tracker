-- 004 · habits — spec/03-data-model.md §2
--
-- The 10-active-habit cap (FR-2.1) is a trigger in 013, not a client check.
-- Habits are archived via archived_at, never deleted: deletion would orphan
-- their logs and silently rewrite the history the wall grid displays.

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

alter table habits enable row level security;
