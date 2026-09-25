-- 018 · the hourly challenge sweep, scheduled in the database — spec/04 §4.
--
-- Owner decision 2026-09-25: pg_cron, not Vercel Cron. Vercel's Hobby plan runs
-- crons daily at most, which cannot honour FR-1.4's local midnight, and an
-- in-database schedule works on any hosting plan with no secret on the network.
-- /api/cron/seed-challenges still exists (04 §4: "keep the name and the route")
-- and calls the same function, for manual runs and a later smarter selector.
--
-- run_challenge_sweep() is the one entry point for both, so the sweep is logged
-- the same way whichever of them ran it (LOG-1). The agent uses no model in
-- Phase 1, and the log says so.

create extension if not exists pg_cron;

create or replace function run_challenge_sweep() returns integer
language plpgsql
set search_path = public
as $$
declare
  started timestamptz := clock_timestamp();
  seeded  integer;
begin
  seeded := seed_daily_challenge();

  insert into agent_logs (agent_id, model, latency_ms, success)
  values ('challenge_generator_agent', 'none',
          (extract(epoch from clock_timestamp() - started) * 1000)::int, true);

  return seeded;
end $$;

revoke execute on function run_challenge_sweep() from public, anon, authenticated;
grant execute on function run_challenge_sweep() to service_role;

-- Minute 0 of every hour. Scheduling by name replaces an existing job of the
-- same name, so re-applying this migration cannot stack a second sweep.
select cron.schedule('seed-daily-challenges', '0 * * * *',
                     'select public.run_challenge_sweep()');
