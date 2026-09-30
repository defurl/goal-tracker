-- 022 · habit_logs and daily_challenges become read-only to their owner —
-- D-23 §13 (owner decision 2026-09-30).
--
-- 012 gave both tables an owner-writable `for all` policy. That let a user
-- backfill habit_logs to build a streak and farm the +50 weekly bonus, and
-- reset daily_challenges.roll_count past D-15's cap of three. Only their own
-- room was affected, but points are meant to be awarded server-side only
-- (CLAUDE.md rule 12), and a writable history is a way round that.
--
-- Every legitimate write already goes through a security-definer function —
-- ensure_daily_challenge, roll_challenge and complete_challenge (019),
-- log_habit (020) — which run as the table owner and are not subject to these
-- policies. The client reads both tables and writes neither. So the owner
-- keeps SELECT and loses INSERT, UPDATE and DELETE. Deleting a user or a habit
-- still cascades: foreign-key actions are not checked against RLS.

drop policy own_challenges on daily_challenges;
drop policy own_habit_logs on habit_logs;

create policy own_challenges_read on daily_challenges for select using (user_id = auth.uid());
create policy own_habit_logs_read on habit_logs       for select using (user_id = auth.uid());
