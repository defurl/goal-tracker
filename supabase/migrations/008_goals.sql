-- 008 · goals — spec/03-data-model.md §5

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

alter table goals enable row level security;
