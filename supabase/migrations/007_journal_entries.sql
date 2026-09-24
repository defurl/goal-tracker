-- 007 · journal_entries — spec/03-data-model.md §3. THE PRIVACY-CRITICAL TABLE.
--
-- There is deliberately NO column able to hold the entry text, and adding one
-- is a breach of FR-3.6. Raw text exists only in the request body, in memory,
-- for the duration of the agent call. Only the AI summary is stored.
--
-- A reviewer checking that promise should be able to confirm it from this
-- create table statement alone. That is the point of enforcing it here.

create table journal_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  date           date not null,
  mood           text not null,              -- emoji key, e.g. 'calm'
  -- Stored apart from mood so the calendar (FR-3.5) need not map emoji to
  -- sentiment at render time.
  mood_score     smallint not null check (mood_score between -2 and 2),
  tags           text[] not null default '{}',
  ai_summary     text check (length(ai_summary) <= 600),
  ai_emotion     text check (length(ai_emotion) <= 40),
  ai_strength    text check (length(ai_strength) <= 200),
  ai_next_action text check (length(ai_next_action) <= 200),
  created_at     timestamptz not null default now(),
  unique (user_id, date)
);

alter table journal_entries enable row level security;
