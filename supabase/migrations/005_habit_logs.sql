-- 005 · habit_logs — spec/03-data-model.md §2
--
-- check (points_awarded >= 0) is D-08 made structural. The SRS had -5 for a
-- relapse; it is removed, and the schema rejects it if anyone reintroduces it.
--
-- user_id is denormalised on purpose: an RLS policy that has to join to habits
-- to find the owner is slower and easier to get wrong.

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

alter table habit_logs enable row level security;
