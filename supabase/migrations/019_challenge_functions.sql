-- 019 · Daily Challenge write paths — FR-1.4 to FR-1.6, D-15.
--
-- award_points() is service-role only (013), so a feature that awards points
-- needs a server-side path that decides the amount itself. These functions are
-- that path: callable by a signed-in user, acting only on auth.uid()'s rows,
-- with no user-id and no points argument to forge. PROPOSED — the spec names
-- award_points() as the one writer of the ledger and says nothing about who
-- calls it; this keeps it the one writer and puts every caller in the database,
-- where each award and its row change commit together or not at all.
--
--   local_today(user)          the user's local date, from profiles.timezone
--   ensure_daily_challenge()   today's challenge, if missing and one is possible
--   roll_challenge(id)         FR-1.5 — a different pending action, at most 3 a day
--   complete_challenge(id)     FR-1.6 — +30 once, action marked done

-- ── local_today() ───────────────────────────────────────────────────────────
-- Every award is dated by the user's local day (03 §4), and it is computed
-- here rather than taken from the browser, whose clock is the user's to set.

create or replace function local_today(p_user_id uuid) returns date
language sql stable
set search_path = public
as $$
  select (now() at time zone timezone)::date from profiles where id = p_user_id;
$$;

revoke execute on function local_today(uuid) from public, anon, authenticated;

-- ── ensure_daily_challenge() ────────────────────────────────────────────────
-- The hourly sweep (018) seeds at the first hour past local midnight. A user
-- who imports their first action at 10:00 would otherwise wait for 11:00 with a
-- pending action and an empty monitor. This is the sweep's insert for one user,
-- so the unique (user_id, date) still guarantees one row a day (AC-1.3).

create or replace function ensure_daily_challenge() returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  insert into daily_challenges (user_id, action_id, date)
  select uid, ua.id, local_today(uid)
  from user_actions ua
  where ua.user_id = uid and ua.status = 'pending'
  order by random()
  limit 1
  on conflict (user_id, date) do nothing;
end $$;

revoke execute on function ensure_daily_challenge() from public, anon;
grant execute on function ensure_daily_challenge() to authenticated;

-- ── roll_challenge() ────────────────────────────────────────────────────────
-- FR-1.5 and D-15. The replaced action stays pending: skipping it today is not
-- a verdict on it, and it can come round again another day.

create or replace function roll_challenge(p_challenge_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  c    daily_challenges%rowtype;
  next_action uuid;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into c from daily_challenges
  where id = p_challenge_id and user_id = uid
  for update;
  if not found then
    raise exception 'challenge_not_found';
  end if;
  if c.completed_at is not null then
    raise exception 'challenge_complete';
  end if;
  if c.roll_count >= 3 then
    raise exception 'roll_cap_reached';
  end if;

  select id into next_action from user_actions
  where user_id = uid and status = 'pending' and id <> c.action_id
  order by random()
  limit 1;
  if next_action is null then
    raise exception 'no_other_pending';
  end if;

  update daily_challenges
  set action_id = next_action, roll_count = roll_count + 1
  where id = c.id;
end $$;

revoke execute on function roll_challenge(uuid) from public, anon;
grant execute on function roll_challenge(uuid) to authenticated;

-- ── complete_challenge() ────────────────────────────────────────────────────
-- FR-1.6: +30 and the action marked done. Only TODAY's challenge awards:
-- daily_challenges is owner-writable (012), so a user could insert a challenge
-- for any past date, and awarding those would mint 30 points per invented day.
-- With the date pinned to today, unique (user_id, date) bounds it at one a day.
-- Completing an older challenge still marks it done; it just awards nothing.

create or replace function complete_challenge(p_challenge_id uuid) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c   daily_challenges%rowtype;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into c from daily_challenges
  where id = p_challenge_id and user_id = uid
  for update;
  if not found then
    raise exception 'challenge_not_found';
  end if;
  if c.completed_at is not null then
    return;
  end if;

  update daily_challenges set completed_at = now() where id = c.id;
  update user_actions set status = 'done' where id = c.action_id and user_id = uid;

  if c.date = local_today(uid) then
    perform award_points(uid, 'daily_challenge', 30, c.id, c.date);
  end if;
end $$;

revoke execute on function complete_challenge(uuid) from public, anon;
grant execute on function complete_challenge(uuid) to authenticated;
