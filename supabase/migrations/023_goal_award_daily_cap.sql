-- 023 · a goal completion awards points at most once per user per day —
-- D-23 §14 (owner decision 2026-09-30).
--
-- 021 awards +100 once per goal, ever, but put no bound on goals themselves:
-- create a goal with one milestone, tick it, +100, repeat. The bound lives in
-- award_points(), the one door every award goes through, so no future caller
-- can route round it.
--
-- A second goal completed the same day is not lost: set_milestone() awards a
-- goal only if it has never been awarded, so completing it again on a later
-- day pays out then.
--
-- The advisory lock is per user and per transaction: two goals completed at
-- the same moment are serialised, so both cannot see "none today" and award.
-- Every other event is unchanged — the ledger's own key keeps them idempotent.
-- Grants are kept by `create or replace`.

create or replace function award_points(
  p_user_id uuid, p_event point_event, p_points int,
  p_ref_id uuid, p_date date
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if p_event = 'goal_complete' then
    perform pg_advisory_xact_lock(hashtext('goal_complete:' || p_user_id::text));
    if exists (select 1 from point_ledger
               where user_id = p_user_id and event = 'goal_complete' and date = p_date) then
      return;
    end if;
  end if;

  insert into point_ledger (user_id, event, points, ref_id, date)
  values (p_user_id, p_event, p_points, p_ref_id, p_date)
  on conflict do nothing;             -- idempotent

  if found then
    insert into glow_points (user_id, total) values (p_user_id, p_points)
    on conflict (user_id) do update
      set total = glow_points.total + excluded.total,
          updated_at = now();
  end if;
end $$;
