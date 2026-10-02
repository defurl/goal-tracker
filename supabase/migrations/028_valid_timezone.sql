-- 028 · a profile's timezone is a real IANA zone — pre-launch security
-- hardening, 2026-10-01. PROPOSED.
--
-- profiles.timezone is free text the owner may write (026 grants UPDATE on it;
-- hydrate() records the browser's zone). Postgres' `at time zone` accepts far
-- more than zone names, and refuses some text outright, and both were faults:
--
--   1. One bad value stopped the sweep for everyone. seed_daily_challenge()
--      is a single INSERT … SELECT over every profile; a zone Postgres does
--      not recognise raises, and that hour nobody's challenge was seeded.
--   2. POSIX offset strings reach a week either side. 'XYZ-160' is seven days
--      ahead of UTC, 'UTC+100' four behind. Every daily bound — habit awards,
--      Perfect Day, the challenge's +30, the AI caps — is keyed to the local
--      date, so a user could open a fortnight of days at once.
--
-- Now: a write to timezone must name a zone in pg_timezone_names (UTC−12 to
-- UTC+14, so at most three local dates exist at any moment), any stored value
-- that does not is reset to UTC, and the sweep skips a zone it cannot read
-- rather than failing for everyone. Switching between real zones is still
-- possible; see the note in spec/03 §2.
--
-- Asserted in supabase/tests/timezone.test.ts.

update profiles set timezone = 'UTC'
where timezone not in (select name from pg_timezone_names);

create or replace function enforce_valid_timezone() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  return new;
end $$;

revoke execute on function enforce_valid_timezone() from public, anon, authenticated;

create trigger profiles_valid_timezone before insert or update of timezone on profiles
  for each row execute function enforce_valid_timezone();

-- 013's sweep, unchanged but for the last condition. Grants are kept by
-- `create or replace`.
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
    and p.timezone in (select name from pg_timezone_names)
  on conflict (user_id, date) do nothing;

  get diagnostics seeded = row_count;
  return seeded;
end $$;
