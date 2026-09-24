-- 012 · every RLS policy in the product — spec/03-data-model.md §7
--
-- Kept in one file on purpose: a reviewer can read every policy on one screen,
-- which is the only way this stays auditable. A policy added anywhere else is a
-- review finding.
--
-- RLS itself is enabled in each table's own migration (001–011), so no table
-- ever existed without it. It is enabled again here, idempotently, so this file
-- alone states the complete position: twelve tables, no exceptions. A table
-- without RLS in this project is a bug, not an optimisation.
--
-- The gate for this file is supabase/tests/isolation.test.ts — as user A, read
-- and write all twelve tables as user B; all 24 attempts must fail.

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

-- ── Owner-scoped full access ────────────────────────────────────────────────
-- `for all using (...)` with no `with check`: Postgres applies the USING
-- expression to new rows as well, so a user cannot insert or update a row into
-- someone else's name.

create policy own_profile      on profiles         for all using (id = auth.uid());
create policy own_actions      on user_actions     for all using (user_id = auth.uid());
create policy own_challenges   on daily_challenges for all using (user_id = auth.uid());
create policy own_habits       on habits           for all using (user_id = auth.uid());
create policy own_habit_logs   on habit_logs       for all using (user_id = auth.uid());
create policy own_journal      on journal_entries  for all using (user_id = auth.uid());
create policy own_goals        on goals            for all using (user_id = auth.uid());
create policy own_milestones   on milestones       for all using (user_id = auth.uid());

-- ── Read-only to the user ───────────────────────────────────────────────────
-- Written only by security-definer functions and the service role. For the
-- ledger and the total this is X-6 made structural: the client can never write
-- its own score.

create policy read_own_ledger  on point_ledger for select using (user_id = auth.uid());
create policy read_own_points  on glow_points  for select using (user_id = auth.uid());
create policy read_own_logs    on agent_logs   for select using (user_id = auth.uid());

-- ── rate_limits: service role only ──────────────────────────────────────────
-- No user-facing policy at all, deliberately. With RLS on and no policy, every
-- anon and authenticated request is denied; the service role bypasses RLS.
