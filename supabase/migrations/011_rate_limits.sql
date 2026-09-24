-- 011 · rate_limits — spec/03-data-model.md §6. Enforces RATE-1 server-side.
--
-- 012 gives this table NO user policy at all: a user who can write their own
-- rate-limit row has no rate limit. Only the service role touches it,
-- incrementing and checking in one statement (§6) so two concurrent requests
-- cannot both pass.

create table rate_limits (
  user_id   uuid not null references auth.users(id) on delete cascade,
  agent_id  text not null,
  date      date not null,
  count     int  not null default 0 check (count >= 0),
  primary key (user_id, agent_id, date)
);

alter table rate_limits enable row level security;
