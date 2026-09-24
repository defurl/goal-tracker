-- 015 · an award with no ref is still awarded once — owner decision 2026-09-24
--
-- 006's unique (user_id, event, ref_id, date) is what makes award_points()
-- idempotent. But Postgres treats NULLs as distinct in a unique constraint, so
-- an award with no natural ref — perfect_day, +25 once per day — could land
-- twice for the same day and move the total both times.
--
-- NULLS NOT DISTINCT (Postgres 15+) makes a missing ref equal to itself. The
-- award_points() body needs no change: its bare `on conflict do nothing` honours
-- whichever unique constraint the row hits.

alter table point_ledger drop constraint point_ledger_user_id_event_ref_id_date_key;
alter table point_ledger add constraint point_ledger_user_id_event_ref_id_date_key
  unique nulls not distinct (user_id, event, ref_id, date);
