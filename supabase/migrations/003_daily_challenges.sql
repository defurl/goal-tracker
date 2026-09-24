-- 003 · daily_challenges — spec/03-data-model.md §2
--
-- One row per user per local day.

create table daily_challenges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  action_id     uuid not null references user_actions(id) on delete cascade,
  date          date not null,              -- the user's LOCAL date
  roll_count    int  not null default 0 check (roll_count >= 0),
  completed_at  timestamptz,
  -- What makes the hourly sweep safe to re-run: a second attempt for the same
  -- local day is a no-op conflict, not a duplicate challenge.
  unique (user_id, date)
);

alter table daily_challenges enable row level security;
