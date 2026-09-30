-- 024 · every stored AI row records the prompt version that produced it —
-- 04 §7, D-23 §15 (owner decision 2026-09-30).
--
-- "Record which version produced a row where the output is user-visible, so a
-- regression can be traced to a prompt change rather than guessed at." Two
-- tables hold agent output: user_actions (the extraction agent) and the ai_*
-- fields of journal_entries (the journal agent).
--
-- Null means no prompt produced the row: a curated fallback action, or a
-- journal day saved with mood and tags only.
--
-- The check admits a version number and nothing else. journal_entries is the
-- privacy-critical table (FR-3.6): no column on it may be able to hold prose,
-- and this one cannot.

alter table user_actions
  add column prompt_version text check (prompt_version ~ '^[0-9]+\.[0-9]+$');

alter table journal_entries
  add column prompt_version text check (prompt_version ~ '^[0-9]+\.[0-9]+$');
