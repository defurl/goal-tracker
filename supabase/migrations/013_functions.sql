-- 013 · functions and triggers — spec/03-data-model.md §2, §4, §5 and
-- spec/04-ai-agents.md §4
--
--   award_points()          the ONLY writer of point_ledger and glow_points (X-6)
--   enforce_habit_cap()     FR-2.1, at most 10 active habits
--   enforce_milestone_cap() FR-4.2, at most 5 milestones per goal
--   seed_daily_challenge()  FR-1.4, the hourly local-midnight sweep
--   handle_new_user()       creates the profiles row the seeder reads
--
-- ── Who may call what ───────────────────────────────────────────────────────
-- Postgres grants EXECUTE on every new function to PUBLIC, and Supabase's
-- default privileges grant it to anon and authenticated as well — which makes
-- every function here callable from the browser as /rest/v1/rpc/<name>. For
-- award_points() that would be fatal: it takes the user id and the amount as
-- arguments, so a signed-in user could award anyone any number of points. The
-- spec's "the client can never write its own score" holds only if EXECUTE is
-- revoked, so every function below is revoked from PUBLIC, anon and
-- authenticated and granted to service_role alone.
--
-- Every function pins search_path. A security-definer function that resolves
-- names through the caller's search_path can be made to call the caller's
-- objects with the owner's rights.

-- ── award_points() ──────────────────────────────────────────────────────────
-- Idempotent: the ledger's unique (user_id, event, ref_id, date) turns a second
-- award for the same thing into a no-op, and the total only moves if the ledger
-- row was actually inserted.

create or replace function award_points(
  p_user_id uuid, p_event point_event, p_points int,
  p_ref_id uuid, p_date date
) returns void
language plpgsql security definer
set search_path = public
as $$
begin
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

revoke execute on function award_points(uuid, point_event, int, uuid, date)
  from public, anon, authenticated;
grant execute on function award_points(uuid, point_event, int, uuid, date)
  to service_role;

-- ── enforce_habit_cap() ─────────────────────────────────────────────────────
-- FR-2.1 in the database, not only in the client. Counts active habits only:
-- an archived habit frees its slot.

create or replace function enforce_habit_cap() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from habits
      where user_id = new.user_id and archived_at is null) >= 10 then
    raise exception 'habit_cap_reached';
  end if;
  return new;
end $$;

create trigger habits_cap before insert on habits
  for each row execute function enforce_habit_cap();

revoke execute on function enforce_habit_cap() from public, anon, authenticated;

-- ── enforce_milestone_cap() ─────────────────────────────────────────────────
-- FR-4.2, "same trigger pattern as the habit cap" (03-data-model.md §5).

create or replace function enforce_milestone_cap() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from milestones where goal_id = new.goal_id) >= 5 then
    raise exception 'milestone_cap_reached';
  end if;
  return new;
end $$;

create trigger milestones_cap before insert on milestones
  for each row execute function enforce_milestone_cap();

revoke execute on function enforce_milestone_cap() from public, anon, authenticated;

-- ── seed_daily_challenge() ──────────────────────────────────────────────────
-- 04-ai-agents.md §4. Runs at minute 0 of every hour. For each user, is it past
-- local midnight on a date they have no challenge for? If so, insert one.
-- `on conflict do nothing` against unique (user_id, date) is what makes an
-- hourly re-run safe. Users with no pending actions are skipped and get the
-- FR-1.7 empty state instead.
--
-- Phase 1 uses no model: FR-1.4 says "randomly select", which is
-- order by random(). Returns the number of challenges seeded, for the log.

create or replace function seed_daily_challenge() returns integer
language plpgsql
set search_path = public
as $$
declare
  seeded integer;
begin
  insert into daily_challenges (user_id, action_id, date)
  select p.id,
         (select ua.id from user_actions ua
           where ua.user_id = p.id and ua.status = 'pending'
           order by random() limit 1),
         (now() at time zone p.timezone)::date
  from profiles p
  where exists (select 1 from user_actions ua
                where ua.user_id = p.id and ua.status = 'pending')
  on conflict (user_id, date) do nothing;

  get diagnostics seeded = row_count;
  return seeded;
end $$;

revoke execute on function seed_daily_challenge() from public, anon, authenticated;
grant execute on function seed_daily_challenge() to service_role;

-- ── handle_new_user() ───────────────────────────────────────────────────────
-- Not in 03-data-model.md, and PROPOSED: without it no profiles row exists, and
-- the seeder — which reads FROM profiles — skips every user who signed up. The
-- row starts at the column default, UTC; the client sets the real timezone.

create or replace function handle_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

revoke execute on function handle_new_user() from public, anon, authenticated;
