-- 026 · every role holds only the table privileges it uses — pre-launch
-- security hardening, 2026-10-01. PROPOSED.
--
-- Supabase's default privileges gave anon, authenticated and service_role ALL
-- on every table in public: SELECT, INSERT, UPDATE and DELETE, and TRUNCATE,
-- REFERENCES, TRIGGER and (Postgres 17) MAINTAIN besides. RLS (012, 022, 025)
-- decides which rows a statement reaches; it never narrowed the verbs or the
-- columns, and TRUNCATE ignores it altogether. So until now:
--
--   - a signed-out visitor held every privilege on every table. RLS returned
--     no rows, but the OpenAPI root (/rest/v1/) still listed every table,
--     column and verb to the anon key.
--   - a signed-in user could write any column of an owner-writable row: a
--     habit's streak and type, an action's status, a goal's or a milestone's
--     completed_at. None of it minted points — 019–021 decide every amount and
--     020 and 023 bound them — but those columns are the server's to write.
--
-- From here each role holds exactly what the code uses. Every read and write
-- was traced to its call site, and each grant below names it:
--
--   anon           nothing. A signed-out visitor reads no table: hydrate()
--                  finds no user and draws the default room (spec/05 §7).
--   authenticated  SELECT where the browser or the server's user client reads;
--                  INSERT and UPDATE on the columns the app writes and no
--                  others; DELETE on nothing. Nothing in the product deletes a
--                  row as the user: habits are archived (03 §2), and an account
--                  is deleted by the service role and the cascades (B5.2).
--   service_role   SELECT, INSERT, UPDATE and DELETE on every table. It is the
--                  server's key (app/api/_lib/server.ts) and the tests' seeding
--                  role, and it bypasses RLS by design.
--
-- No role but the owner keeps TRUNCATE, REFERENCES, TRIGGER or MAINTAIN.
-- Migrations run as postgres, the owner, and lose nothing.
--
-- Grants sit outside RLS, not instead of it. A column the role may not write
-- is refused with 42501 before any row is looked at; a column it may write
-- still reaches only the rows the policies allow.
--
-- ── What this means for every later migration ───────────────────────────────
-- The default privileges change at the bottom of this file, so nothing created
-- in public arrives open:
--
--   - a new TABLE grants nothing to anon or authenticated. Its migration grants
--     authenticated what the app does with it, the way this file does, and anon
--     nothing. service_role still gets SELECT, INSERT, UPDATE and DELETE.
--   - a new COLUMN the app writes needs a column grant. Until it has one, the
--     insert or update that names it fails with 42501.
--   - a new FUNCTION is executable by its owner and service_role only. PUBLIC no
--     longer gets EXECUTE by default — that default is how anon reached every
--     function before (013's header). A function the browser calls still needs
--     its own `grant execute ... to authenticated`, as 019–021 have.
--   - a new SEQUENCE grants nothing to anon or authenticated.
--
-- Objects that supabase_admin creates in public — an extension installed there
-- from the dashboard — still get Supabase's own broad defaults, which postgres
-- cannot change. Install extensions into the `extensions` schema.
--
-- Asserted in supabase/tests/privileges.test.ts: the catalog, a table and a
-- function created after this file, and every write path the app has, driven
-- through a signed-in client.

-- ── anon: nothing ───────────────────────────────────────────────────────────

revoke all on table
  profiles, user_actions, daily_challenges, habits, habit_logs, point_ledger,
  glow_points, journal_entries, goals, milestones, agent_logs, rate_limits,
  user_plans
from anon;

-- ── authenticated: from nothing to what the app uses ────────────────────────

revoke all on table
  profiles, user_actions, daily_challenges, habits, habit_logs, point_ledger,
  glow_points, journal_entries, goals, milestones, agent_logs, rate_limits,
  user_plans
from authenticated;

-- Read-only to their owner (012, 022, 025). Every write is a security-definer
-- function's, which runs as the owner and needs no grant here.
grant select on table
  daily_challenges,   -- lib/data/challenge.ts, today's challenge
  habit_logs,         -- lib/data/habits.ts and history.ts, the day grid and the hall
  point_ledger,       -- lib/data/points.ts, today's points
  glow_points,        -- lib/data/points.ts, the total
  agent_logs,         -- lib/data/journal.ts, reflections left today
  user_plans          -- read_own_plan (025); the agents read it as the service role
to authenticated;

-- Owner-writable (012). Every column can be read; only the written ones written.
grant select on table
  profiles, user_actions, habits, journal_entries, goals, milestones
to authenticated;

-- hydrate() records the browser's zone over the UTC default (lib/data/hydrate.ts).
-- The row itself is handle_new_user()'s.
grant update (timezone) on profiles to authenticated;

-- The extraction agent stores its action through the caller's own client
-- (lib/agents/extract.ts). status belongs to the challenge functions (019).
grant insert (user_id, action_text, source_url, source_summary, prompt_version)
  on user_actions to authenticated;

-- Created and archived (lib/data/habits.ts createHabit, archiveHabit). streak
-- and longest_streak are log_habit()'s (020); a habit's type is fixed once it
-- exists, because log_habit() pays by it.
grant insert (user_id, name, type, frequency) on habits to authenticated;
grant update (archived_at) on habits to authenticated;

-- Mood, tags and the day, upserted on (user_id, date) by lib/data/journal.ts
-- saveEntry and lib/agents/reflect.ts. PostgREST's upsert sets every column it
-- was sent, the conflict key included, so user_id and date need UPDATE as well
-- as INSERT. The ai_* fields and prompt_version are written by reflect.ts,
-- through the caller's own client, once the agent has answered. There is still
-- no column for the entry text (FR-3.6).
grant insert (user_id, date, mood, mood_score, tags) on journal_entries to authenticated;
grant update (user_id, date, mood, mood_score, tags,
              ai_summary, ai_emotion, ai_strength, ai_next_action, prompt_version)
  on journal_entries to authenticated;

-- Created together (lib/data/goals.ts createGoal). completed_at, on both, is
-- set_milestone()'s (021).
grant insert (user_id, title, category, description, start_date, target_date)
  on goals to authenticated;
grant insert (goal_id, user_id, title, sort_order) on milestones to authenticated;

-- rate_limits: nothing at all, as 011 and 012 intend.

-- ── service_role: reads and writes, nothing structural ──────────────────────

revoke all on table
  profiles, user_actions, daily_challenges, habits, habit_logs, point_ledger,
  glow_points, journal_entries, goals, milestones, agent_logs, rate_limits,
  user_plans
from service_role;

grant select, insert, update, delete on table
  profiles, user_actions, daily_challenges, habits, habit_logs, point_ledger,
  glow_points, journal_entries, goals, milestones, agent_logs, rate_limits,
  user_plans
to service_role;

-- ── default privileges, for whatever later migrations create ────────────────

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- PUBLIC's EXECUTE is Postgres' own default for every schema, and a per-schema
-- statement cannot take a global default away — so it is revoked globally, for
-- every function postgres creates. anon's and authenticated's came from
-- Supabase, per schema, and are revoked per schema.
alter default privileges for role postgres
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;

-- PostgREST caches what it may show; tell it now rather than on its next poll.
notify pgrst, 'reload schema';
