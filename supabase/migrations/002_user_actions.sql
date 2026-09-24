-- 002 · user_actions — spec/03-data-model.md §2
--
-- The library of extracted micro-actions (F1).

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

-- The seeder queries exactly this pair for every user, every hour.
create index on user_actions (user_id, status);

alter table user_actions enable row level security;
