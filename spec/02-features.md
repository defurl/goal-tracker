# 02 — Feature Specifications

> Status: **LOCKED** except where marked. Requirement IDs (FR-x.y, US-x.y) are
> carried over from the SRS unchanged so the two documents stay cross-referenceable.
> Acceptance criteria (AC-x.y) are new — the SRS had none, and an agent team
> needs them to know when a task is finished.

**Every feature ships to both surfaces in the same phase** — the 3D room and the
`/text` route. See `01-decisions.md` D-07. A feature that works in only one
surface is not done.

---

## Feature 1 — Action Launcher & Daily Challenge · P0

The anchor feature. Converts external content into a concrete, immediately
executable action.

**Room binding:** Monitor 1 (amber, `[-0.3, 0.306, -0.4]`) displays today's
challenge. The Phone (`[0.7, 0, -0.1]`) is the import portal.

### User stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-1.1 | User | Paste a URL or text from an article | The app distils it into one micro-action I can do right now |
| US-1.2 | User | See a "Do It Now" affordance prominently | There is zero friction between reading the action and starting it |
| US-1.3 | User | Receive one Daily Challenge drawn from my saved content | I stay engaged with my library without manual searching |
| US-1.4 | User | Re-roll the Daily Challenge | I can skip challenges that do not fit today's energy |

### Functional requirements

- **FR-1.1** The system SHALL accept URL input and extract readable text
  (Mozilla Readability or equivalent), and SHALL accept pasted raw text as an
  alternative input.
- **FR-1.2** The system SHALL invoke `content_extraction_agent` (`04-ai-agents.md` §2)
  to generate a micro-action of ≤ 40 words, doable in under two minutes.
- **FR-1.3** Each extracted micro-action SHALL be stored in `user_actions`.
- **FR-1.4** The Daily Challenge SHALL be seeded at 00:00 **user local time** by
  selecting one `user_actions` row with `status = 'pending'`.
- **FR-1.5** "Roll Again" SHALL replace today's challenge with a different
  pending action and increment `roll_count`. **Capped at 3 per day**
  (`01-decisions.md` D-15); at the cap the control disables with a stated
  reason rather than disappearing.
- **FR-1.6** Completing an action SHALL award Glow-up Points per the ledger and
  set `status = 'done'`.
- **FR-1.7** If the user has no pending actions, the Daily Challenge SHALL show
  a welcoming empty state that routes to import — never a blank surface or an
  error.

> **FR-1.4 is the subtle one.** "User local time" means the seeder cannot be a
> single 00:00 UTC cron. See `04-ai-agents.md` §4 for the hourly-sweep pattern
> that resolves this. The SRS said 00:00 UTC in one place and user local time in
> another; user local time is correct.

### Acceptance criteria

- **AC-1.1** Given a valid article URL, when the user submits it, then within
  10 s a micro-action of ≤ 40 words beginning with an imperative verb is stored
  and shown.
- **AC-1.2** Given the extraction agent fails or returns unparseable output,
  when the user submits, then a curated fallback action is returned and **no
  error is shown**. (FALLBACK-1.)
- **AC-1.3** Given a user with ≥ 1 pending action, when their local date rolls
  over, then exactly one `daily_challenges` row exists for that user and date.
- **AC-1.4** Given a user with 0 pending actions, when they open the app, then
  the empty state appears with a route into import.
- **AC-1.5** Given today's challenge is complete, then monitor 1's emissive
  intensity is 1.4 and the points total has increased by 30.
- **AC-1.6** Roll Again is unavailable (disabled, with a reason) once
  `roll_count` reaches its cap.

### Room behaviour

Monitor 1 renders its content as a **canvas texture** driven from the store —
not a drei `<Html>` element. An HTML element pretending to be a screen breaks
the moment the camera tilts. Title in Fraunces italic, prompt body in Departure
Mono, faint source URL at the bottom.

Completion maps to emissive intensity **`1.1 → 1.4`**, lerped. The floor is 1.1,
not the 0.6 doc 12 originally proposed: monitor 1's portfolio baseline is
`SIGNAL_AMBER_DIM @ 1.2` (luminance ~0.12) and the bloom pass thresholds at 0.10,
so anything below ~1.0 stops blooming altogether and the screen goes flat for the
whole of an ordinary uncompleted day. See `01-decisions.md` D-20.

**The hover lift must be clamped.** `../design-system/08-interaction-grammar.md`
§2 lifts emissive by `base * 1.2` on hover; at a completed 1.4 that reaches 1.68,
past the 1.4 band ceiling in `06-materials.md` where bloom smears. Use
`Math.min(base * 1.2, 1.4)`.

**Verify lighting acceptance criterion 1 at 1.4** — the lamp pool must still be
the brightest area in frame. If it is not, lower the ceiling rather than the
floor (`12-habit-tracker-adaptation.md` §4).

The Phone brightens its screen emissive while extraction runs (~1.3 s), lerping
from `VOXEL_GLOW_SOFT` toward `SIGNAL_AMBER_DIM`, then monitor 1's texture
updates. Its panel is transient: URL field, status line, extracted preview,
closes on completion.

---

## Feature 2 — Glow-up Habit Tracker · P0

A daily checklist whose completions visibly grow the room.

**Room binding:** the bonsai (`[-0.8, 0, 0.1]`) accumulates leaves; the back
wall panel grid (centre `x = -0.75, y ≈ 0.493`) shows the daily calendar.

### User stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-2.1 | User | Create habits tagged "build" or "break" | I track what I am adding and what I am quitting separately |
| US-2.2 | User | Check off habits with a single tap | Daily completion feels fast |
| US-2.3 | User | See my Glow-up Points increase immediately | I get feedback for consistency |
| US-2.4 | User | Watch a visual metaphor grow | Progress feels tangible, not just numerical |
| US-2.5 | User | See my streak count per habit | I can see my own consistency |

> US-2.5 is reworded from the SRS, which framed it as a loss-aversion mechanic.
> See `01-decisions.md` D-09.

### Functional requirements

- **FR-2.1** Users SHALL create up to **10 habits** (hard cap, to avoid overwhelm).
- **FR-2.2** Each habit SHALL have: name, type (`build` | `break`), frequency
  (`daily` | `weekdays` | custom days), and an optional reminder time (stored,
  not acted on in Phase 1).
- **FR-2.3** Completing a habit SHALL award: build = **+10**, break (avoided) = **+15**.
- **FR-2.4** A daily completion rate ≥ 80 % of *due* habits SHALL award a
  Perfect Day bonus of **+25**.
- **FR-2.5** The bonsai SHALL gain leaves at cumulative point thresholds; it
  SHALL NEVER lose, wilt, brown or drop them under any condition.
- **FR-2.6** Streaks SHALL be tracked per habit and reset on a missed due day.
  The reset SHALL NOT be announced, coloured, animated or messaged.
- **FR-2.7** A relapse on a break habit SHALL award **0 points**, never negative.
  (`01-decisions.md` D-08.)
- **FR-2.8** Check-off SHALL show optimistic UI feedback in **< 100 ms**, before
  server confirmation, and SHALL reconcile or roll back silently on failure.

### Acceptance criteria

- **AC-2.1** Attempting to create an 11th habit is prevented with an
  explanatory message, not a silent failure.
- **AC-2.2** Checking off a build habit increases the points total by exactly
  10 and renders within 100 ms of the tap.
- **AC-2.3** Completing ≥ 80 % of due habits awards exactly one +25 bonus per
  day, and re-checking does not award it twice.
- **AC-2.4** Crossing a leaf threshold triggers a 180 ms droplet then a 900 ms
  leaf reveal. Below a threshold, nothing visible happens.
- **AC-2.5** Skipping a full day and returning produces **no** negative points,
  no colour change, no message, and no reduction in leaf count.
- **AC-2.6** `points_awarded` in `habit_logs` is never negative — enforced by a
  DB check constraint, not only by application code.
- **AC-2.7** A habit not due today does not count toward the Perfect Day
  denominator.

### Room behaviour

**The bonsai.** Leaves are an `InstancedMesh` with a per-instance matrix — one
draw call. Thresholds are **PROPOSED** at cumulative lifetime points
20 / 45 / 70 / 100, then every 100, with the leaf count asymptotic rather than
unbounded (a bonsai with 4,000 leaves is a shrub). Growth uses `--dur-reveal`
(900 ms), never a spring bounce. Leaf colour derives at runtime:
`new Color(DATA_GREEN).multiplyScalar(0.35)`.

**The wall grid.** A 7 × N grid of ~4 cm emissive quads, one per day, inset 2–3 mm
proud of the wall exactly as the Ando joint lines are, centred on a panel centre
(**not** on a joint line, which would straddle the groove). Three states, all
existing tokens: unfilled `INK_GHOST` non-emissive; filled `SIGNAL_AMBER_DIM`
emissive ~0.5; today `SIGNAL_AMBER` emissive ~0.9. **Only the current day is
bright enough for bloom to catch** — a full row of bright cells breaks the rig.
At rest pose this must read as *texture, not data*; the legible version is the
DOM panel on click.

---

## Feature 3 — Smart Journal · P1

Low-friction daily journaling with mood tagging and opt-in AI reflection.

**Room binding:** the Notebook (`[-0.4, 0, 0.05]`).

### User stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-3.1 | User | Write a short entry with minimal prompting | There is no blank-page anxiety |
| US-3.2 | User | Tag my mood with an emoji before writing | I have a quick check-in ritual |
| US-3.3 | User | Add topic tags | I can filter and search entries later |
| US-3.4 | User | Optionally tap "AI Reflect" | I get a supportive synthesis of what I wrote |
| US-3.5 | User | See past entries on a calendar | I can see my emotional journey over time |

### Functional requirements

- **FR-3.1** The entry form SHALL have a mood picker (emoji grid, ≤ 8 options),
  topic multi-select tags, and a freetext area capped at **2000 characters**.
- **FR-3.2** "AI Reflect" SHALL be **opt-in only, never automatic.**
- **FR-3.3** AI output SHALL appear in a clearly delineated block labelled
  "AI Insight", visually distinct from the user's own writing.
- **FR-3.4** Journal data SHALL be private by default. No sharing in MVP.
- **FR-3.5** The calendar view SHALL colour days by mood score.
- **FR-3.6 · PRIVACY, LOAD-BEARING.** `entry_text` SHALL **never be persisted**
  after the agent call. Only the AI-generated summary is stored. This must be
  stated in the Privacy Policy.

> **FR-3.6 is the single most important requirement in this document.** It is a
> promise to the user that the schema must make structurally impossible to
> break, not merely a convention. See `03-data-model.md` §3 — the
> `journal_entries` table has no column capable of holding raw entry text.
>
> The consequence to accept deliberately: **the user cannot re-read what they
> wrote.** Only mood, tags and the AI summary survive. This is a real product
> trade-off, it is intentional, and onboarding copy must say so plainly rather
> than letting a user discover it by losing something.

**FR-3.5 colour mapping.** The SRS specified green / yellow / orange. Those are
not available for this purpose — `../design-system/01-color-palette.md` reserves
`--data-green` and `--data-red` for live data and forbids using them as UI
state. **PROPOSED** replacement, on the amber scale that the wall grid already
uses: positive = `SIGNAL_AMBER` at higher emissive, neutral = `SIGNAL_AMBER_DIM`,
negative = `INK_GHOST` with a faint `VOXEL_GLOW_SOFT` tint. Reads as warmth
present or warmth absent — consistent with the room's own language, and it
avoids colour-coding a person's feelings as good or bad.

### Acceptance criteria

- **AC-3.1** Saving an entry with AI Reflect **off** stores mood, tags and
  timestamp, and stores no entry text anywhere, including logs.
- **AC-3.2** Saving with AI Reflect **on** stores the summary; a database dump
  taken afterwards contains no fragment of the original text.
- **AC-3.3** The AI Insight block is unambiguously distinguishable from user
  content for a first-time user.
- **AC-3.4** Entry text > 2000 characters is prevented at input with a visible
  counter, not truncated on save.
- **AC-3.5** `agent_logs` records the call without recording its input text.
- **AC-3.6** The AI Reflect control is never triggered by save, blur, or any
  event other than a direct activation.

---

## Feature 4 — Goal Dashboard · P1

A visual roadmap turning aspirations into milestones on a timeline.

**Room binding:** Monitor 2 (cyan, `[0.5, 0.27, -0.4]`).

### User stories

| ID | As a… | I want to… | So that… |
|---|---|---|---|
| US-4.1 | User | Create a goal with a target date and category | I have a structured commitment, not a vague wish |
| US-4.2 | User | Break a goal into 3–5 milestones | The path feels achievable in chunks |
| US-4.3 | User | See all goals on a timeline | I understand scope and sequencing at a glance |
| US-4.4 | User | Mark milestones complete | I experience incremental progress |

### Functional requirements

- **FR-4.1** Goals SHALL have: title, category (Health | Career | Learning |
  Relationships | Finance | Other), start date, target date, description.
- **FR-4.2** Each goal SHALL support 1–5 milestones, each with an optional due date.
- **FR-4.3** The timeline SHALL render as hand-authored **SVG** — no charting
  library. (`10-tech-stack.md` keeps dependencies minimal; a Gantt library would
  bring its own visual language and its own palette.)
- **FR-4.4** Completing all milestones SHALL award **+100** points.
- **FR-4.5** An overdue goal SHALL be shown neutrally — no red, no warning
  iconography, no urgency language. (`11-anti-patterns.md`.)

### Acceptance criteria

- **AC-4.1** A goal with a target date before its start date is rejected at input.
- **AC-4.2** Completing the final milestone awards exactly +100 once; un-completing
  and re-completing does not award again.
- **AC-4.3** The timeline is legible at 400 px width with 5 goals.
- **AC-4.4** An overdue goal renders in the same palette as any other.
- **AC-4.5** Monitor 2's canvas texture is legible at rest pose — if it is not,
  it shows a summary and the detail lives in the panel.

---

## Cross-feature requirements

- **X-1** Every widget and panel SHALL have a welcoming empty state. Never a
  blank box, never a spinner alone.
- **X-2** All AI-generated content SHALL show a skeleton while loading, never a
  bare spinner.
- **X-3** All four features SHALL be fully usable via keyboard, and every
  interactive room object SHALL be in the tab order via its hidden 48 × 48 px
  button. (`08-interaction-grammar.md`.)
- **X-4** All four features SHALL work on `/text` with no WebGL.
- **X-5** No feature SHALL display a negative number to the user in any context.
- **X-6** Points are awarded **server-side only.** The client never computes a
  total it then writes. Optimistic UI may *predict* a total for < 100 ms
  feedback, but the server's value is authoritative and reconciles it.
