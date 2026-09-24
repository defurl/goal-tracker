-- 010 · agent_logs — spec/03-data-model.md §6. Satisfies LOG-1.
--
-- Token counts and latency ONLY — never input or output text.
--
-- error_code is a code, not a message. Provider error messages sometimes quote
-- the offending input back, which for journal_analysis_agent would persist the
-- exact text FR-3.6 forbids storing. Map provider errors to a fixed set of
-- codes before they reach this table.

create table agent_logs (
  id            uuid primary key default gen_random_uuid(),
  agent_id      text not null,
  user_id       uuid references auth.users(id) on delete set null,
  model         text not null,
  input_tokens  int,
  output_tokens int,
  latency_ms    int,
  success       boolean not null,
  error_code    text,
  created_at    timestamptz not null default now()
);

create index on agent_logs (user_id, agent_id, created_at desc);

alter table agent_logs enable row level security;
