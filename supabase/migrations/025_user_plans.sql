-- 025 · user_plans — every user has a plan, and the AI caps follow it —
-- D-24 §7 (owner decision 2026-09-30), build plan B5.1.
--
-- Every plan is 'free' for now, and 'free' holds the caps the agents had
-- before (lib/prompts/index.ts). The column exists so a later plan needs no
-- migration; payment stays out of scope (spec/00 §4).
--
-- Its own table, not a column on profiles: own_profile (012) is `for all`, so
-- a user could write a plan column there. Here the owner may read their row and
-- nothing else. The row is made by handle_new_user(), which runs as the table
-- owner, and changed only by the service role or a migration.

create table user_plans (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  plan     text not null default 'free' check (plan in ('free'))
);

alter table user_plans enable row level security;

create policy read_own_plan on user_plans for select using (user_id = auth.uid());

-- Everyone who signed up before this migration.
insert into user_plans (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- 013's trigger, now making both rows.
create or replace function handle_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  insert into public.user_plans (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

revoke execute on function handle_new_user() from public, anon, authenticated;
