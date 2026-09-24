-- 009 · milestones — spec/03-data-model.md §5
--
-- The 5-per-goal cap (FR-4.2) is a trigger in 013, same pattern as the habit
-- cap.

create table milestones (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references goals(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  title        text not null check (length(title) between 1 and 120),
  due_date     date,
  completed_at timestamptz,
  sort_order   smallint not null default 0
);

alter table milestones enable row level security;
