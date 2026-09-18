# 01 — Decision Log

> **Read this before installing a dependency or writing a component.**
>
> The SRS (`Be_Better_Everyday_SRS.docx` v1.0) and the design system
> (`../design-system/`) were written independently and contradict each other in
> twelve places. Every one is resolved below. An agent that follows the SRS
> literally will install Tailwind, shadcn/ui, Inter and a light theme on day one
> and violate the visual contract in four ways simultaneously.
>
> Format: ADR-lite. Each entry has a status, the conflict, the decision, and the
> reasoning. **LOCKED** entries are not up for re-litigation by an implementing
> agent — if you think one is wrong, raise it with the owner and get this file
> amended rather than routing around it in code.

---

## Decisions

D-01 to D-12 resolve direct SRS / design-system conflicts. D-13 fills a gap
both documents left. D-14 to D-19 settle the questions the spec pass raised.

All nineteen are **LOCKED**. There are no open questions.

### D-01 · Styling: no Tailwind, no shadcn/ui — **LOCKED**

**Conflict.** SRS §6.1 specifies Tailwind CSS + shadcn/ui.
`../design-system/11-anti-patterns.md` lists "card grids and feature box
layouts" as a hard no, `01-color-palette.md` defines a complete token palette
enforced by a colour lint, and `10-tech-stack.md` §4 uses CSS Modules.

**Decision.** Drop both. Use **CSS Modules + `tokens.css`** custom properties.

**Reasoning.** shadcn/ui is not a neutral component library — it ships its own
palette, its own radius scale, and a card-centric composition model, all three
of which collide with a design system whose entire premise is that objects, not
cards, are the interface. Tailwind's utility classes would sit alongside a token
system that a CI lint already enforces, giving two sources of truth for colour.
The DOM surface in this product is small (corner furniture, right-hand slide-in
panels, the `/text` route), so the productivity argument for Tailwind is weak
here in a way it would not be for a conventional dashboard.

**Consequence.** Budget real time for hand-built form controls in the panels.
This is the main cost of this decision and it is accepted.

---

### D-02 · Typography: Fraunces / Geist / Departure Mono — **LOCKED**

**Conflict.** SRS §7.3 specifies Inter.
`../design-system/11-anti-patterns.md` lists Inter by name as a hard no.

**Decision.** `../design-system/02-typography.md` wins in full. Display is
**Fraunces** (italic at display sizes), body is **Geist**, mono is **Departure
Mono** with a `JetBrains Mono` fallback. Departure Mono is self-hosted from
`public/fonts/`; the other two come from `@fontsource` packages.

**Reasoning.** The type choice is load-bearing for the room's character — the
in-world hover labels are lowercase wide-tracked Departure Mono, and that single
treatment does more for the aesthetic than any other type decision. Inter is
prohibited explicitly and not by accident.

**Consequence.** All numeric values are mono. `font-variant-numeric: tabular-nums`
globally. See `02-typography.md` for the full scale and the label CSS to copy
verbatim.

---

### D-03 · No light mode — **LOCKED**

**Conflict.** SRS §7.1 defines "Theme A — Earth Tone (Default)" with
`--color-bg: #F9F9F6` and `--color-surface: #FFFFFF`, and SRS Q4 asks whether
dark should be the default. `../design-system/01-color-palette.md` says "there
is no light mode", forbids pure white outright, and `11-anti-patterns.md` lists
"a light-mode toggle" as a hard no.

**Decision.** The product is **nocturnal only**. No light theme, no toggle. SRS
Q4 is answered: dark, and it is not a preference. The Earth Tone palette is
dropped entirely.

**Reasoning.** The five-light rig, every material roughness value, and the
bloom threshold all assume darkness. A light mode is not a CSS variable swap
here — it is a second lighting rig and a second acceptance test. The room's
whole proposition is one warm key light in a very dark space.

**Consequence.** Onboarding copy should not offer a theme choice. The window's
sky plane is where time of day is acknowledged; see `00-product-brief.md` §1.

---

### D-04 · No bento grid in the room — **LOCKED** · bento survives only in `/text`

**Conflict.** SRS §7.2 specifies a bento grid dashboard as the main interface.
`../design-system/08-interaction-grammar.md` §5 says "no card grids — if you
reach for a grid, stop", and the room's premise is that objects are the
navigation and there is no menu.

**Decision.** The 3D room is the dashboard. No bento grid, no widget tiles, no
draggable cards anywhere in the WebGL surface. The `/text` route may use a
simple single-column stacked layout — **not** a card grid, and not styled to
resemble one.

**Reasoning.** These are two incompatible interface philosophies and only one
can be the product. The room was chosen.

**Consequence.** An early HTML mockup of BBE as a bento dashboard exists and is
**superseded**. Do not use it as a reference.

---

### D-05 · Motion: design system durations win — **LOCKED**

**Conflict.** SRS §7.3 specifies Framer Motion, animations under 300 ms, and
"habit check-off celebrations". `../design-system/03-motion.md` sets defaults of
600–900 ms with 1.5–3 s camera moves, and `11-anti-patterns.md` forbids confetti,
badge pops and achievement chimes.

**Decision.** Design system wins. No Framer Motion in the 3D layer (the frame
loop owns animation there); it is permitted in the DOM panels only if it earns
its place, and CSS transitions on the motion tokens are preferred. No celebration
animations of any kind.

**The one exception, already sanctioned:** a habit completion is a live-data
event, and `03-motion.md` principle 4 reserves sharp sub-second motion for
exactly that. A completion gets `--dur-tick` (180 ms) for a single water droplet
falling into the bonsai pot, then `--dur-reveal` (900 ms) for the leaf to appear.
Nothing else, and nothing louder.

---

### D-06 · Framework: Next.js 14 App Router, not Vite — **LOCKED**

**Conflict.** `../design-system/10-tech-stack.md` specifies Vite 5 +
`react-router-dom`. SRS §6.1 specifies Next.js 14 App Router.

**Decision.** **Next.js 14 App Router wins.** Port the design system's
*conventions* into it rather than its build tooling.

**Reasoning.** This is the one conflict the SRS wins, and it wins on hard
requirements the design system never had to consider: AI API keys must be
server-side only (SRS API-1), Supabase auth needs SSR session handling, the
daily challenge seeder needs a cron target, and the PWA needs a service worker.
The portfolio was a static site with no backend. Rebuilding all of that on Vite
to preserve a build tool would be backwards.

**What carries over from `10-tech-stack.md` regardless — all of it non-optional:**

| convention | why it matters |
|---|---|
| `lint:colors` — fails the build on any hex literal outside the palette | stops palette drift; ship in Phase 1 |
| `capture:states` — Playwright screenshots of every named scene state | gives reviewers a diffable visual record |
| Lighting constants in their own file, each with a comment explaining why it differs from the plan | named the single most valuable artefact in the portfolio |
| One file per object: pure geometry + material, no state | interaction is injected by the wrapper from outside |
| A visual spec document outranks prose | `lighting-plan.svg` supersedes any brief |
| Instanced meshes for anything repeated | leaves and calendar cells; one draw call per type |
| `dpr` capped at 2; bloom off on mobile | perf escape hatches, not bugs |

**Consequence — the R3F-in-App-Router gotcha.** React Three Fiber cannot be
server-rendered. Every scene component is `'use client'`, and the canvas is
mounted through `next/dynamic` with `{ ssr: false }`. Get this wrong and the
build fails at prerender time with an opaque error. Document it in the scene
route's file header.

---

### D-07 · `/text` is a first-class surface, not a fallback — **LOCKED**

**Conflict.** Not a contradiction so much as a gap.
`../design-system/08-interaction-grammar.md` §6 requires a plain `/text` route
that renders without WebGL, framing it as the accessibility story. The SRS
requires a PWA that works offline and targets sub-100 ms habit check-off
feedback.

**Decision.** `/text` is promoted from accessibility fallback to a **primary
surface** with three jobs: the a11y story, the **mobile fast path**, and the
**PWA offline shell**. It must reach 100 % of the product's functionality.

**Reasoning.** This is the most consequential architectural call in this file.
BBE's core interaction is a two-minute action checked off on a phone, possibly
on a commute, possibly offline. A WebGL room that must hit 45 fps on mobile is
the wrong surface for that, and no amount of optimisation makes it the right
one. Meanwhile the room is the reason the product is worth using at a desk in
the evening. Trying to make one surface serve both compromises both.

So: the room is the *evening* surface — reflective, atmospheric, where you
journal and watch the bonsai. `/text` is the *moment* surface — fast, offline,
one thumb. Same data, same store contract, two presentations.

**Consequence.** Service worker caches the `/text` shell, not the 3D bundle.
Mobile users land on `/text` by default with a discoverable way into the room.
Every feature ships to both surfaces in the same phase — `/text` is never
allowed to lag, because a lagging fallback quietly becomes a broken one.

---

### D-08 · The relapse penalty is dropped — **LOCKED**

**Conflict.** SRS §3.2.3 awards **−5 points** for a missed break habit ("gentle
negative, not punishing"). `../design-system/11-anti-patterns.md` — in the
additions proposed for this project — says no streak-shaming, and that
`--data-red` is for live data, not for judging the user.

**Decision.** **Remove the −5.** A relapse awards 0 points.

**Reasoning.** A negative number on a screen is a judgement regardless of its
magnitude, and it is the one mechanic in the SRS that contradicts the emotional
register locked in `00-product-brief.md` §1. The product already has a
sufficient signal for a missed day: nothing grows. That is the design system's
stated position — "absence of growth is already the signal; decay is
punishment" — and a points deduction is decay wearing a smaller number.

**Consequence.** The points ledger in `03-data-model.md` §4 has no negative
rows. `points_awarded` is a non-negative integer and the schema enforces it.

---

### D-09 · Streaks reset silently — **LOCKED**

**Conflict.** SRS FR-2.6 resets a streak to 0 on a missed day, and US-2.5
explicitly names "loss aversion" as the mechanic. The anti-patterns forbid
streak-shaming.

**Decision.** Keep streak tracking. **Never announce a reset.** The UI displays
`longest_streak` as the primary number and the current streak secondarily,
without any treatment that marks the transition — no colour change, no message,
no animation, no "you lost your streak" copy anywhere in the product.

**Reasoning.** The data is legitimately useful and worth having; loss aversion
as an engagement lever is exactly the thing this product decided not to trade
on. Tracking it and weaponising it are separable, and we do the first only.

---

### D-10 · Performance budget, restated for a 3D bundle — **LOCKED**

**Conflict.** `../design-system/10-tech-stack.md` §3 sets initial JS ≤ 200 KB
and notes the portfolio achieved 69.4 KB gzipped. Three.js alone is roughly
160 KB gzipped, which reads as an impossible budget.

**Decision.** Not a contradiction — a clarification. **Two budgets:**

| surface | budget | note |
|---|---|---|
| initial route shell (`/text`, auth, dashboard chrome) | ≤ 200 KB gz | contains no three.js |
| the 3D scene chunk (lazy) | ≤ 320 KB gz | three + R3F + drei + scene code |

**Reasoning.** The portfolio hit 69.4 KB initial *because* the scene was
lazy-loaded; three.js was never in the entry bundle. Same discipline applies
here. `bundle:check` asserts both numbers separately.

**Consequence.** Never import from the scene tree in a shared module. The
`/text` route must not transitively pull in three.js — assert this in CI, since
it is very easy to break with a careless shared type import.

---

### D-11 · Glow-up visual: bonsai tree on the desk — **LOCKED**

**Conflict.** SRS Q2 asks: growing tree (more personality) versus energy bar
(simpler)? `../design-system/12-habit-tracker-adaptation.md` §3.2 offered two
tree placements: floor at camera-left, or desk replacing the plant.

**Decision.** **A bonsai tree, on the desk at `[-0.8, 0, 0.1]`**, replacing the
plant mesh. Capped at 0.35 m so it never occludes monitor 1. Leaves are an
`InstancedMesh` — one draw call. Leaf colour derives from `DATA_GREEN` at
reduced scalar, as the existing plant does; no new green token.

**Reasoning.** SRS Q2 answered in favour of the tree. Desk over floor because
the floor placement puts a warm organic mass in the door spill and requires
re-running the lighting acceptance test against a moving occluder, for a payoff
(drama, its own pool of light) that the desk version mostly achieves anyway at
rest pose without the lighting risk.

**Consequence.** The plant is retired. The door spill stays free for the Phase 2
streak-history scene.

---

### D-12 · Icons are minimal and DOM-only — **LOCKED**

**Conflict.** SRS §7.3 specifies Lucide React throughout. The room has no icons
— the objects *are* the affordances, and in-world labels are wide-tracked
lowercase mono text.

**Decision.** No icons in the WebGL layer, ever. Lucide is permitted in the
`/text` route and the DOM panels, line-style only, and used sparingly.

---

### D-13 · The journal agent gets a distress-response path — **LOCKED** (owner-approved 2026-09-18)

**Context.** Not an SRS/design-system conflict — a gap both documents left. The
journal is where a user may write that they are genuinely struggling, and
`journal_analysis_agent`'s normal output shape ("here is a strength you showed,
here is a micro-action for tomorrow") is the wrong answer to that.

**Decision.** The agent detects signs of crisis or acute distress and switches
to a support response. Full prompt wording, schema and rendering rules are in
`04-ai-agents.md` §3.

Four constraints that are part of the decision, not implementation detail:

1. **The model never generates a phone number, helpline name or URL.** Any
   resource shown to the user comes from a static, human-verified list in the UI
   layer. A hallucinated crisis line is worse than no crisis line, and models
   misremember these numbers.
2. **The flag is never persisted.** `support_response` exists in the response
   body only — not in `journal_entries`, not in `agent_logs`, not in analytics.
   Storing "this user was in distress on date X" would be exactly the kind of
   health-adjacent record FR-3.6 exists to prevent, and it would outlive the
   moment it was true.
3. **It does not diagnose and does not escalate.** No clinical language, no
   alarm, no notification to anyone, and no claim about what a support service
   will or will not do — those vary and BBE is not in a position to promise them.
4. **It is not a clinical feature and must not present as one.** The register
   stays what it always was: warm, brief, human.

**Reasoning.** Shipping a product that invites people to write down how they
feel, and then answers a hard entry with a cheerful productivity tip, is a
failure the team would not want to discover from a user. The cost of the path is
one prompt clause and one branch in the panel renderer.

---

---

### D-14 · The aesthetic thesis is ratified — **LOCKED** (owner-approved 2026-09-18)

`../design-system/00-aesthetic-thesis.md` requires a one-sentence thesis that
every design decision is judged against. BBE's, now ratified:

> **"The same 3 a.m. desk — but every object on it is evidence that you acted
> on something you saved."**

`00-product-brief.md` §1 is updated to LOCKED. Judge design proposals against
this sentence; if one cannot be defended against it, it does not belong.

---

### D-15 · "Roll Again" is capped at 3 per day — **LOCKED** (owner-approved 2026-09-18)

Answers SRS Q5. `roll_count` caps at 3; the control then disables with a stated
reason rather than disappearing (AC-1.6).

**Reasoning.** Unlimited re-rolling turns the Daily Challenge into a slot machine
and erodes the commitment the feature exists to create. Three is enough to skip
a challenge that genuinely does not fit today's energy — the stated purpose in
US-1.4 — without letting the user shop for an easy one indefinitely.

---

### D-16 · Journal AI stays opt-in — **LOCKED** (owner-approved 2026-09-18)

Answers SRS Q3. "AI Reflect" is a deliberate activation. It is never triggered
by save, by blur, or by any other event (FR-3.2, AC-3.6).

**Reasoning.** Auto-triggering would send every entry to a provider whether or
not the user wanted it read, which is incompatible with the privacy posture the
product is built on. Opt-in also makes the 3/day rate limit legible rather than
mysterious.

---

### D-17 · Supabase Free tier for Phase 1 — **LOCKED** (owner-approved 2026-09-18)

Answers SRS Q6. Free tier (500 MAU ceiling) through MVP; move to Pro when
approaching it.

**Reasoning.** The Phase 1 target is under 500 concurrent users. Paying from day
one buys headroom that the MVP has no plan to use. Set a calendar reminder to
check MAU before the ceiling rather than discovering it in production — the
failure mode of hitting it is user-visible.

---

### D-18 · Mug steam deferred to Phase 2 — **LOCKED** (owner-approved 2026-09-18)

The mug gains a morning steam wisp as a time-of-day tell. Cosmetic, cheap,
on-thesis — and not a Phase 1 blocker. Build it after the four features ship.

---

### D-19 · One AI provider in Phase 1 — **LOCKED** (owner-approved 2026-09-18)

Build the `AgentProvider` interface, implement `OpenAIProvider`, leave
`GeminiProvider` unwritten. See `04-ai-agents.md` §8.

**Reasoning.** Two live providers means two prompt-tuning surfaces, two JSON-mode
dialects and two sets of error semantics to map — real cost, before any evidence
the fallback is needed. The curated fallback array already covers the
user-facing failure case, which is the one that matters. The interface means
adding Gemini later is an afternoon, not a refactor.

---

## Open questions

**None currently open.** Every question raised during the spec pass has been
decided; D-01 to D-19 are the complete set.

Three things remain marked **PROPOSED** in other documents. They are reasoned
defaults, not open questions — build against them, and flag them in your PR so
they get a real decision once there is something concrete to look at:

| item | where | why it is not locked yet |
|---|---|---|
| Bonsai leaf thresholds (20 / 45 / 70 / 100, then every 100) | `05-scene-state-contract.md` §4 | needs a real points history to tune against. The function signature is what matters; the curve is adjustable in one place. |
| Journal mood colour mapping on the amber scale | `02-features.md` FR-3.5 | replaces the SRS's green/yellow/orange, which the palette reserves for live data. Wants a look at the calendar view before locking. |
| Phase task sizing in the build plan | `06-build-plan.md` | sequencing is locked; estimates are not, and should not be treated as commitments. |

To raise a new question: add it here with a recommendation, get a decision, then
promote it to a numbered D-entry. Do not leave a question un-numbered and
un-owned — that is how it gets silently resolved in code by whoever hits it first.


## Amending this file

An implementing agent does not amend a LOCKED entry. Raise it, get a decision,
then add a dated amendment note under the entry rather than editing the original
text — the reasoning trail is the point of this file.
