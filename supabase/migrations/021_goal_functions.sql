-- 021 · milestone completion — FR-4.4, AC-4.2.
--
-- Same shape as 019 and 020. PROPOSED.
--
-- set_milestone(id, complete) marks one milestone done or not done, then keeps
-- the goal's completed_at in step with its milestones. The first time every
-- milestone of a goal is done, the goal awards +100 — once per goal, ever:
-- un-completing and re-completing on a later day must not award again
-- (AC-4.2), and the ledger's (user, event, ref, date) key alone would allow
-- one award per day, so the function checks for any earlier award first. The
-- goal row is locked, so two concurrent completions cannot both see none.

create or replace function set_milestone(p_milestone_id uuid, p_complete boolean) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  goal    uuid;
  total   int;
  done    int;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select goal_id into goal from milestones
  where id = p_milestone_id and user_id = uid;
  if not found then
    raise exception 'milestone_not_found';
  end if;

  perform 1 from goals where id = goal and user_id = uid for update;

  update milestones
  set completed_at = case when p_complete then coalesce(completed_at, now()) end
  where id = p_milestone_id;

  select count(*), count(completed_at) into total, done
  from milestones where goal_id = goal;

  if total > 0 and done = total then
    update goals set completed_at = coalesce(completed_at, now()) where id = goal;

    if not exists (select 1 from point_ledger
                   where user_id = uid and event = 'goal_complete' and ref_id = goal) then
      perform award_points(uid, 'goal_complete', 100, goal, local_today(uid));
    end if;
  else
    update goals set completed_at = null where id = goal;
  end if;
end $$;

revoke execute on function set_milestone(uuid, boolean) from public, anon;
grant execute on function set_milestone(uuid, boolean) to authenticated;
