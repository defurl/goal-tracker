# 04 — AI Agent Layer

> Status: **LOCKED.** This is the primary reference for anyone touching AI.
>
> BBE uses a deliberately unambitious agentic pattern: **deterministic routing →
> stateless single call → structured JSON → schema validation → database write.**
> There is no long-running agent, no multi-turn conversation, no tool-calling
> loop and no memory in MVP. Every call is independently replayable.
>
> If you find yourself wanting an agent framework, you have misread the scope.

---

## 1. Execution pattern

```
Client
  ↓  POST /api/agent/{name}     (authenticated)
API route
  ↓  1. verify Supabase JWT → user_id
  ↓  2. increment + check rate_limits  → 429 if over
  ↓  3. validate input (Zod)
  ↓  4. load versioned prompt from lib/prompts/
  ↓  5. call provider, JSON mode ON
  ↓  6. parse + validate output (Zod)      ─── fail → retry once ─── fail → fallback
  ↓  7. write result to Supabase
  ↓  8. write agent_logs row (tokens, latency — NEVER content)
Client  ← result
```

Non-negotiables:

- **API keys are server-side only** (API-1). They live in Vercel environment
  variables and are read only inside `app/api/`. A key reachable from a client
  component is a shipped credential leak.
- **The user never sees an AI error** (FALLBACK-1). Every failure path ends in a
  curated fallback. "The AI is unavailable" is not an acceptable user-facing
  state for any of these features.
- **Every call is logged** (LOG-1) to `agent_logs` — token counts, latency,
  success, an error *code*. Never input or output text.

---

## 2. `content_extraction_agent`

Converts an article into one micro-action. The anchor of Feature 1.

| | |
|---|---|
| **Trigger** | `POST /api/agent/extract` `{ url?: string, text?: string }` |
| **Model** | `gpt-4o-mini` |
| **Max tokens** | 150 |
| **Temperature** | 0.3 |
| **JSON mode** | ON |
| **Rate limit** | **20 / user / day** |
| **Writes** | `user_actions` |

### Prompt — `lib/prompts/contentExtraction.ts`

```ts
export const CONTENT_EXTRACTION_V1 = {
  version: '1.0',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 150,
  systemPrompt: `You are an action extraction assistant. Given the following article or text, extract exactly ONE concrete micro-action the reader can take in under 2 minutes.

Rules:
1. The action must start with an imperative verb (Write, Call, Try, Block, ...).
2. Maximum 40 words.
3. No motivational filler. Pure action.
4. Return JSON: { "action": "<text>", "source_summary": "<1 sentence>" }`,
  schema: z.object({
    action: z.string().min(1).max(300),
    source_summary: z.string().min(1).max(500),
  }),
} as const;
```

### Input handling

`url` is fetched server-side and reduced to readable text with Mozilla
Readability before it reaches the model. Three guards, all required:

- **Timeout** the fetch at 8 s. A slow origin must not hold an API route open.
- **Cap** extracted text at ~6000 characters before sending. Truncate from the
  end; article leads carry the actionable content.
- **Refuse** non-HTML content types, and never follow a redirect to a private
  address. Accepting a user-supplied URL and fetching it server-side is SSRF
  by default — block loopback, link-local and RFC1918 targets explicitly.

### Failure ladder

1. Provider error or unparseable JSON → **retry once** with the same input.
2. Second failure → return a **curated fallback** from a static array, marked
   `source_summary: 'Fallback action'`, and log `success: false`.
3. The user sees a normal micro-action either way.

Fallback array lives in `lib/prompts/fallbacks.ts` and needs at least 20 generic
two-minute actions — enough that a user hitting the fallback path twice in a
week does not see the same one.

---

## 3. `journal_analysis_agent`

Turns a journal entry into a supportive reflection. **The privacy-critical agent.**

| | |
|---|---|
| **Trigger** | `POST /api/agent/reflect` `{ entry_text, mood, tags }` |
| **Model** | `gpt-4o-mini` |
| **Max tokens** | 200 |
| **Temperature** | 0.7 |
| **JSON mode** | ON |
| **Rate limit** | **3 / user / day** |
| **Writes** | `journal_entries` (summary fields only) |

### Prompt — `lib/prompts/journalAnalysis.ts`

```ts
export const JOURNAL_ANALYSIS_V1 = {
  version: '1.0',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 200,
  systemPrompt: `You are a warm, non-judgmental personal growth coach.
The user just finished a journal entry. Your job:
1. Identify the PRIMARY emotion beneath the writing (one word).
2. Surface ONE positive pattern or strength the user showed.
3. Offer ONE gentle, specific micro-action for tomorrow.
4. Keep your entire response under 80 words.
5. Tone: supportive coach, NOT therapist. No clinical language.
6. If the entry suggests the user is in crisis, considering self-harm, or in acute distress, set "support_response": true and change your response:
   - "summary": a brief, warm message acknowledging what they are carrying, and encouraging them to talk to someone they trust or reach a local support line. Calm, not alarmed. Do not diagnose.
   - "next_action": something small and grounding — a short walk, a glass of water, messaging one person. Never a productivity task.
   - "strength": something true and gentle about the fact that they wrote this down at all.
   - NEVER include a phone number, a helpline name, or a URL. The app supplies those.
   Otherwise set "support_response": false.

Return JSON:
{ "primary_emotion": "...", "strength": "...", "next_action": "...", "summary": "...", "support_response": false }`,
  schema: z.object({
    primary_emotion: z.string().max(40),
    strength: z.string().max(200),
    next_action: z.string().max(200),
    summary: z.string().max(600),
    support_response: z.boolean().default(false),   // see Safety posture below
  }),
} as const;
```

### Privacy contract — FR-3.6

`entry_text` exists in exactly three places and no others: the HTTPS request
body, the route handler's memory for the duration of the call, and the provider
request. It is **never**:

- written to `journal_entries` (the table has no column for it — `03-data-model.md` §3)
- written to `agent_logs` (token counts only)
- included in an error message, a Sentry breadcrumb, a `console.log`, or a
  structured log field
- sent to any analytics or session-replay tool
- cached, queued, or retried through a durable queue

Two practical consequences that are easy to get wrong:

**Do not log the request body on error.** The natural instinct when an API route
fails is to log its input. That single line would break the product's central
privacy promise. Add a comment in the route handler saying so, because the next
agent to debug this will otherwise add it back.

**Map provider errors to codes before logging.** Provider error payloads
sometimes echo the offending input. Convert to a fixed enum
(`RATE_LIMIT`, `TIMEOUT`, `PARSE_FAIL`, `PROVIDER_ERROR`) at the boundary.

### Safety posture — **LOCKED** (`01-decisions.md` D-13)

The prompt's register is "supportive coach, NOT therapist", and that register
carries a responsibility. A journal is where someone may write that they are
genuinely struggling, and the agent's normal output shape — a strength, a
micro-action for tomorrow — is the wrong answer to that entry.

Rule 6 of the system prompt above handles it. Four constraints on the
implementation, all load-bearing:

**The model never generates a resource.** No phone numbers, no helpline names,
no URLs — the prompt forbids it explicitly. Models misremember these numbers,
and a hallucinated crisis line is worse than none at all. When
`support_response` is true, the UI appends a resource block from a **static,
human-verified list** maintained in the repo, chosen by the user's locale. Keep
that list short, keep it current, and make updating it someone's job.

Do not attach claims about what a service will do — confidentiality policies and
escalation procedures vary by provider and country, and BBE is not in a position
to promise them on anyone's behalf.

**`support_response` is never persisted.** It exists in the HTTP response body
and in the panel's render state, and nowhere else:

- not in `journal_entries` — there is no column for it and there must not be
- not in `agent_logs` — log the call as an ordinary success
- not in analytics, error tracking, or any event stream

A stored flag saying "this user was in distress on 2026-09-18" is precisely the
health-adjacent record that FR-3.6 exists to prevent, and unlike the moment it
described, it would persist indefinitely.

**The panel renders it differently.** When `support_response` is true, the
"AI Insight" block drops its usual structure. No "strength you showed" heading,
no framing that reads as achievement, no gamification of any kind attached to
that entry. Summary, then the grounding action, then the resource block. Quiet
typography, no amber highlight, nothing that draws a celebratory eye.

**It does not escalate.** No notification to anyone, no email, no flag to an
operator. BBE has no one on call and pretending otherwise would be worse than
being clear about what it is.

> **Edge case worth handling:** a user who has spent their 3 daily reflections
> gets a 429 and never reaches the agent. Make sure the curated fallback shown
> in that case is neutral and gentle rather than breezily upbeat — it is the one
> message that ships without any awareness of what was written.

---

## 4. `challenge_generator_agent`

Seeds one Daily Challenge per user per local day.

| | |
|---|---|
| **Trigger** | scheduled sweep, hourly |
| **Model** | none in Phase 1 — see below |
| **Rate limit** | system-level |
| **Writes** | `daily_challenges` |

### Phase 1 uses no model at all

The SRS lists this as an AI agent. For MVP it does not need to be one: FR-1.4
says "randomly select one `user_actions` row with `status = 'pending'`", which is
`order by random() limit 1`. Calling a language model to choose randomly from a
list would spend budget and add a failure mode for no gain.

Keep the name and the route so a genuinely intelligent selector can replace it
later — choosing by time of day, recent mood, or the user's least-touched
category is a real Phase 2 feature. Phase 1 is deterministic SQL.

### The local-midnight problem

FR-1.4 requires seeding at 00:00 **user local time**, and users span time zones.
A single 00:00 UTC cron gives a user in `Asia/Ho_Chi_Minh` their new challenge
at 7 a.m. and one in `America/Los_Angeles` theirs at 5 p.m. the day before.

**Pattern: an hourly sweep.** Run at minute 0 of every hour. For each user, ask
whether it is currently past local midnight on a date they have no challenge
for; if so, insert one.

```sql
-- seed_daily_challenge(): runs hourly, idempotent
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
```

`on conflict do nothing` against `unique (user_id, date)` is what makes an
hourly re-run safe. Users with no pending actions are skipped and get the
FR-1.7 empty state instead.

At MVP scale (< 500 users) one sweep is a single cheap query. Past a few
thousand users, batch it by timezone offset.

**Scheduling:** Vercel Cron or a Supabase scheduled function, whichever the team
prefers — but note that Vercel Cron on the Hobby plan is limited to daily
invocations, which is not enough. Confirm the plan before choosing.

---

## 5. Agent registry

| Agent | Trigger | Model | Output schema | Rate limit |
|---|---|---|---|---|
| `content_extraction_agent` | `POST /api/agent/extract` | `gpt-4o-mini` | `{ action, source_summary }` | 20 / user / day |
| `journal_analysis_agent` | `POST /api/agent/reflect` | `gpt-4o-mini` | `{ primary_emotion, strength, next_action, summary }` | 3 / user / day |
| `challenge_generator_agent` | hourly sweep | none (Phase 1) | — | system |

SRS Q1 ("primary AI model for the reflection agent?") is answered here:
`gpt-4o-mini` for everything, per COST-2.

---

## 6. Cost controls and observability

- **COST-1** — the OpenAI key MUST have a **$20/day hard spend cap** set in the
  provider dashboard. This is the real backstop; application rate limits are the
  first line but a bug can defeat them, and a billing cap cannot be defeated by
  a bug in this codebase.
- **COST-2** — `gpt-4o-mini` is the default and the ceiling for MVP. Escalating
  to `gpt-4o` requires a demonstrated quality gap, not an intuition.
- **RATE-1** — per-user limits enforced server-side via the `rate_limits` table
  (`03-data-model.md` §6), atomically. Return 429 with `Retry-After`.
- **LOG-1** — every call writes an `agent_logs` row, success or failure.

### Worst-case spend

Worth computing, because the rate limits only look safe until you multiply them.

At 500 users each exhausting both user-facing limits daily — 20 extractions and
3 reflections — that is 11,500 calls/day. At `gpt-4o-mini` pricing with the
token caps above (~1.5k in / 150 out for extraction, ~600 in / 200 out for
reflection), this lands in the low single-digit dollars per day: comfortably
under the $20 cap, with roughly an order of magnitude of headroom.

The number to watch is not the per-call cost but the **extraction input size**.
The 6000-character cap in §2 is the actual cost control; without it a user
pasting a long document repeatedly is the one realistic path to the cap. Keep it.

---

## 7. Prompt versioning

All templates live in `lib/prompts/*.ts` as exported constants — never inline in
a route handler. Each carries a `version`, the model, the parameters and its Zod
schema together, so a prompt and the shape it promises cannot drift apart.

Changing a prompt means **adding `_V2` alongside `_V1`**, not editing `_V1` in
place. Record which version produced a row where the output is user-visible, so
a regression can be traced to a prompt change rather than guessed at.

```
lib/prompts/
  contentExtraction.ts    CONTENT_EXTRACTION_V1
  journalAnalysis.ts      JOURNAL_ANALYSIS_V1
  fallbacks.ts            CURATED_FALLBACK_ACTIONS (≥ 20)
  index.ts                registry: agent id → active version
```

---

## 8. Provider fallback

SRS §6.1 lists Gemini 1.5 Flash as a fallback. **LOCKED (`01-decisions.md`
D-19): build the interface, wire one provider.**

```ts
interface AgentProvider {
  complete(req: CompletionRequest): Promise<CompletionResult>;
}
```

Implement `OpenAIProvider` against it now and leave `GeminiProvider` unwritten.
Two live providers means two prompt-tuning surfaces, two JSON-mode dialects and
two sets of error semantics to map — real cost, before any evidence the fallback
is needed. The curated fallback array already covers the user-facing failure
case, which is the one that matters.
