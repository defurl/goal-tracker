-- 017 · consume_rate_limit() — spec/03-data-model.md §6, spec/04 RATE-1.
--
-- §6 gives the statement: increment and check in one statement, so two
-- concurrent requests cannot both pass. PostgREST cannot express
-- `do update set count = rate_limits.count + 1`, so the statement lives here and
-- the API routes call it as an RPC. The route compares the returned count with
-- the agent's cap; a count past the cap is a 429 and no provider call.
--
-- Service role only, like the table it writes. A user who could call this could
-- only raise their own count, but rate_limits has no user path at all (012) and
-- this keeps it that way.

create or replace function consume_rate_limit(
  p_user_id uuid, p_agent_id text, p_date date
) returns integer
language sql
set search_path = public
as $$
  insert into rate_limits (user_id, agent_id, date, count)
  values (p_user_id, p_agent_id, p_date, 1)
  on conflict (user_id, agent_id, date)
    do update set count = rate_limits.count + 1
  returning count;
$$;

revoke execute on function consume_rate_limit(uuid, text, date)
  from public, anon, authenticated;
grant execute on function consume_rate_limit(uuid, text, date) to service_role;
