-- 016 · the 10-habit cap has no way round it — owner decision 2026-09-24
--
-- 013's enforce_habit_cap() had two holes:
--
--   1. A race. It counts, then lets the insert through. Two inserts at nine
--      active habits could both count nine and both succeed, leaving eleven.
--   2. Un-archiving. The trigger fired before INSERT only, so setting
--      archived_at back to null on an old habit made an eleventh active one.
--
-- Now: the trigger also fires when archived_at changes, and it takes a
-- per-user transaction lock before counting, so concurrent writers for the
-- same user queue behind each other. The lock is per user — nobody waits on
-- anyone else's habits — and it is released at commit.

create or replace function enforce_habit_cap() returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only a row that is becoming active can break the cap.
  if new.archived_at is not null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.archived_at is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('habit_cap:' || new.user_id::text, 0));

  -- A fresh snapshot after the lock, so a writer that queued sees the rows the
  -- one ahead of it committed. `id <> new.id` keeps an updated row from
  -- counting itself.
  if (select count(*) from habits
      where user_id = new.user_id and archived_at is null and id <> new.id) >= 10 then
    raise exception 'habit_cap_reached';
  end if;
  return new;
end $$;

drop trigger habits_cap on habits;
create trigger habits_cap before insert or update of archived_at on habits
  for each row execute function enforce_habit_cap();

revoke execute on function enforce_habit_cap() from public, anon, authenticated;
