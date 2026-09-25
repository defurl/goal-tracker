-- 020 · habit check-off — FR-2.3 to FR-2.7, D-08, D-09.
--
-- Same shape as 019: the one path that awards habit points, callable by a
-- signed-in user for their own habits, the amount decided here. PROPOSED.
--
-- log_habit(id, completed) records TODAY's state for one habit, then:
--   build completed      +10          (per habit, per day)
--   break completed      +15          "avoided" — the harder change
--   break not completed  0            a relapse awards nothing, never less (D-08)
--   streak hits 7, 14…   +50          weekly_streak, per habit, per day
--   ≥ 80 % of due done   +25          perfect_day, once a day (015)
--
-- Un-checking never takes points back — the ledger is append-only and there is
-- no negative row to write (D-08). Re-checking awards nothing new, because the
-- ledger key is (user, event, habit, day).
--
-- Streaks are recomputed, not incremented, and a reset is silent (D-09): the
-- number simply is what it is.
--
-- Frequency days are Postgres' extract(dow): 0 = Sunday … 6 = Saturday.

create or replace function habit_due_on(p_frequency jsonb, p_date date) returns boolean
language sql immutable
set search_path = public
as $$
  select coalesce(p_frequency -> 'days', '[]'::jsonb) @> to_jsonb(extract(dow from p_date)::int);
$$;

revoke execute on function habit_due_on(jsonb, date) from public, anon, authenticated;

create or replace function log_habit(p_habit_id uuid, p_completed boolean) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  h          habits%rowtype;
  tz         text;
  today      date;
  born       date;
  d          date;
  run        int := 0;
  due_count  int;
  done_count int;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  -- One check-off at a time per user, so the daily award bound and Perfect Day
  -- are counted against a settled day rather than a racing one.
  perform pg_advisory_xact_lock(hashtextextended('habit_points:' || uid::text, 0));

  select * into h from habits
  where id = p_habit_id and user_id = uid and archived_at is null
  for update;
  if not found then
    raise exception 'habit_not_found';
  end if;

  select timezone into tz from profiles where id = uid;
  today := (now() at time zone tz)::date;
  born  := (h.created_at at time zone tz)::date;

  insert into habit_logs (habit_id, user_id, date, completed)
  values (h.id, uid, today, p_completed)
  on conflict (habit_id, date) do update set completed = excluded.completed;

  -- ── the habit's own award ──────────────────────────────────────────────
  -- Bounded at ten habit awards a day, the active-habit cap (FR-2.1). Without
  -- it, archiving and re-creating habits would mint a fresh +15 per cycle.
  if p_completed and (
    select count(*) from point_ledger
    where user_id = uid and date = today and event in ('build_habit', 'break_habit')
  ) < 10 then
    if h.type = 'build' then
      perform award_points(uid, 'build_habit', 10, h.id, today);
    else
      perform award_points(uid, 'break_habit', 15, h.id, today);
    end if;
  end if;

  update habit_logs
  set points_awarded = coalesce((
    select points from point_ledger
    where user_id = uid and ref_id = h.id and date = today
      and event in ('build_habit', 'break_habit')
  ), 0)
  where habit_id = h.id and date = today;

  -- ── streak ─────────────────────────────────────────────────────────────
  -- Consecutive completed due days, ending today. Today not yet done does not
  -- break the run — the day is not over. Days before the habit existed end it.
  d := today;
  while d >= born and d > today - 400 loop
    if habit_due_on(h.frequency, d) then
      if exists (select 1 from habit_logs
                 where habit_id = h.id and date = d and completed) then
        run := run + 1;
      elsif d <> today then
        exit;
      end if;
    end if;
    d := d - 1;
  end loop;

  update habits
  set streak = run, longest_streak = greatest(longest_streak, run)
  where id = h.id;

  if p_completed and run > 0 and run % 7 = 0 then
    perform award_points(uid, 'weekly_streak', 50, h.id, today);
  end if;

  -- ── Perfect Day ────────────────────────────────────────────────────────
  -- Denominator: active habits due today that existed today (AC-2.7).
  select count(*),
         count(*) filter (where exists (
           select 1 from habit_logs l
           where l.habit_id = x.id and l.date = today and l.completed))
  into due_count, done_count
  from habits x
  where x.user_id = uid and x.archived_at is null
    and habit_due_on(x.frequency, today)
    and (x.created_at at time zone tz)::date <= today;

  if due_count > 0 and done_count * 5 >= due_count * 4 then
    perform award_points(uid, 'perfect_day', 25, null, today);
  end if;
end $$;

revoke execute on function log_habit(uuid, boolean) from public, anon;
grant execute on function log_habit(uuid, boolean) to authenticated;
