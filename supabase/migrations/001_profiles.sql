-- 001 · profiles — spec/03-data-model.md §2
--
-- Extends auth.users. Exists chiefly to hold the timezone FR-1.4 needs: the
-- daily challenge is seeded at the user's LOCAL midnight, which is why the
-- seeder is an hourly sweep and not one 00:00 UTC cron (04-ai-agents.md §4).
--
-- RLS is enabled in every table's own migration and the policies live in 012,
-- so every policy in the product can be reviewed on one screen. Between the
-- two, RLS-on with no policy means deny-all — the safe failure.

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  timezone    text not null default 'UTC',   -- IANA, e.g. 'Asia/Ho_Chi_Minh'
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;
