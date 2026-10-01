# 06 — Build Plan

> Status: **LOCKED** for sequencing; task estimates are **PROPOSED**.
>
> This plan is written for a multi-agent team working in parallel. Each phase
> states its **tracks** (what can run concurrently), its **gate** (what must be
> true to move on), and the **verification** that proves the gate.
>
> The single most important instruction, carried from
> `../design-system/12-habit-tracker-adaptation.md` §7:
>
> > **Resist building the tree first.** It is the exciting part and it is the
> > part most likely to break the lighting that makes the room worth reusing.

---

## 1. Repository structure

Adapted from `../design-system/10-tech-stack.md` §4 into Next.js App Router
(`01-decisions.md` D-06). The conventions are load-bearing; the framework changed
and they did not.

```
be-better-everyday/
├── app/
│   ├── (auth)/                      login, signup
│   ├── (app)/
│   │   ├── page.tsx                 the room — 'use client', dynamic ssr:false
│   │   └── text/page.tsx            the /text surface (D-07)
│   └── api/
│       ├── agent/extract/route.ts
│       ├── agent/reflect/route.ts
│       └── cron/seed-challenge/route.ts
│
├── scene/                           ← everything WebGL. Nothing else imports this.
│   ├── RoomScene.tsx                lights + objects + rig. No DOM.
│   ├── lighting.ts                  ★ light constants, each commented with WHY
│   ├── cameraPoses.ts               REST + per-object focus poses
│   ├── CameraRig.tsx                useFrame only, renders null
│   ├── InteractiveObject.tsx        the shared interaction wrapper
│   ├── objects/                     one file per prop — pure geometry + material
│   │   ├── DeskSurface.tsx  Lamp.tsx  Monitor.tsx  Window.tsx
│   │   ├── Keyboard.tsx  Mug.tsx  Notebook.tsx  Phone.tsx  Headphones.tsx
│   │   ├── AndoWallDetails.tsx  DustMotes.tsx
│   │   ├── Bonsai.tsx               ← new (F2)
│   │   └── WallTracker.tsx          ← new (F2)
│   └── postfx/                      gated effect passes
│
├── overlay/                         DOM panels + corner controls (CSS Modules)
├── lib/
│   ├── prompts/                     versioned templates + fallbacks
│   ├── agents/                      provider interface + OpenAIProvider
│   ├── supabase/                    client, server client, database.types.ts
│   ├── stores/                      app / interaction / scene
│   ├── data/                        the ONLY writer to useAppStore
│   ├── growth.ts                    ★ leafCountForPoints — single source of truth
│   ├── motion/                      reduced-motion hook
│   └── perf/                        useAdaptiveFps
├── styles/
│   ├── tokens.css                   palette mirror — CSS custom properties
│   └── globals.css                  resets, fonts, grain
├── design-spec.jsonc                palette mirror — the contract
├── lighting-plan.svg                the visual lighting contract
├── supabase/migrations/             001…013, per 03-data-model.md §1
└── scripts/
    ├── lint-colors.ts               ★ fails build on hex outside the palette
    ├── bundle-check.ts              ★ asserts both budgets (D-10)
    └── capture-states.ts            ★ Playwright screenshots of every scene state
```

★ = named in `10-tech-stack.md` as the artefacts that kept the portfolio honest.
Ship all five in Phase 0. They are cheap then and expensive to retrofit.

**Three conventions to preserve:**

1. **Lighting constants live in their own file**, exported, with a comment on
   every value explaining why it differs from the plan. `10-tech-stack.md` calls
   this "the single most valuable artefact in the whole project". When a value
   gets tuned, the reason is recorded next to it.
2. **A visual spec document outranks prose.** `lighting-plan.svg` supersedes any
   written brief.
3. **One file per object** — pure geometry and material, no state. Interaction is
   injected by the wrapper from outside.

---

## 2. Phases

### Phase 0 — Foundation · blocks everything

Single track. Nothing else starts until this is done, so keep it tight.

| # | Task |
|---|---|
| 0.1 | Next.js 14 App Router + TypeScript 5.6, pnpm, `.nvmrc` |
| 0.2 | Port all three palette mirrors: `tokens.css`, `colors.ts`, `design-spec.jsonc` |
| 0.3 | `lint-colors` script + CI wiring |
| 0.4 | Fonts: `@fontsource/fraunces`, `@fontsource/geist-sans`, self-hosted Departure Mono |
| 0.5 | `globals.css` — resets, `tabular-nums` on `html/body/#root`, grain, reduced-motion escape hatch |
| 0.6 | Empty zustand stores per `05-scene-state-contract.md` §2 |
| 0.7 | ESLint 9 flat config, `--max-warnings=0`, Husky + commitlint |
| 0.8 | `bundle-check` with both budgets from D-10 |

**Gate:** `pnpm lint && pnpm lint:colors && pnpm build` passes on an empty app.
A deliberately introduced hex literal fails the build.

---

### Phase 1 — Two parallel tracks

#### Track A · The empty room

Build it in this order and screenshot after each step.

| # | Task |
|---|---|
| A1.1 | Floor, back wall, right wall as four segments around the window opening |
| A1.2 | Ando concrete detailing — joints + 72 tie-rod holes, back wall; right-wall treatment |
| A1.3 | The desk — top, legs, walnut drawers, brass handles (the two sanctioned hex literals) |
| A1.4 | The five-light rig from `05-lighting-rig.md`, values commented with their tuning reasons |
| A1.5 | `CameraRig` + rest pose |
| A1.6 | `useAdaptiveFps`, reduced-motion hook |

**Gate — the lighting acceptance test.** All five must read TRUE in a
lighting-only screenshot:

- [ ] The lamp pool is visibly the brightest area in frame
- [ ] The right edge reads measurably cooler than the left
- [ ] A warm rectangle of light is visible on the floor at camera-left
- [ ] The keyboard area sits in the lamp's outer falloff (~20 % brightness)
- [ ] No object is pure black; no object is fully lit by ambient flood

**Nothing else goes in the room until this passes.** It is the reason the room
is worth reusing.

> **Amendment, 2026-09-18 (owner-approved): the gate runs after the desk-object
> pass, not on the bare room.** Criteria 2 and 4 cannot be evaluated on an empty
> room — criterion 4 measures the keyboard's lit face and criterion 2 depends on
> monitor 2's emissive and the window for the cool side of the frame. Measured
> on the bare room the keyboard zone reads 3.3% of the lamp pool against the
> ~20% the test asks for, purely because there is no keyboard to catch the light.
>
> So A1.1–A1.6 build the shell, desk, rig, camera and hooks; then the desk
> objects land; then the five criteria are judged. **The rule itself is
> unchanged — no object that emits or blocks light beyond the desk dressing goes
> in until all five read TRUE**, which still keeps the bonsai, wall tracker and
> monitor textures behind the gate. What moved is where the measurement happens,
> not what it licenses.

> **Amendment, 2026-09-24 (owner-instructed; verification, not sequencing):
> every lighting gate is measured against a production build.** Captures taken
> from `pnpm dev` are not valid evidence for this test. The adaptive-FPS detector
> trips on a dev build and disables bloom, so a dev capture labelled "effects
> on" is an effects-off frame: measured, the keyboard read 15.4% of the lamp pool
> from `pnpm dev` and 20.4% from `pnpm start`, while the reduced-motion frames —
> bloom off either way — agreed exactly. The "on and off" requirement in the
> Phase 2 gate was, in practice, testing "off" twice.
>
> This applies to every re-run the plan asks for: this gate, the Phase 2 track A
> gate, and each of the eight Phase 3 mechanics. `capture:states` documents it,
> and the `scene-capture` CI job builds and serves before capturing, so a pull
> request cannot pass on dev-server evidence. **Sequencing is unchanged.**

#### Track B · Data foundation

| # | Task |
|---|---|
| B1.1 | Supabase project; auth (email + Google OAuth); SSR session handling |
| B1.2 | Migrations 001–011 per `03-data-model.md` §1 |
| B1.3 | Migration 012 — every RLS policy, reviewable as one file |
| B1.4 | Migration 013 — `award_points()`, `enforce_habit_cap()`, `seed_daily_challenge()` |
| B1.5 | `pnpm supabase gen types` → committed `database.types.ts` |
| B1.6 | `lib/data/` skeleton — the only writer to `useAppStore` |

**Gate — the cross-user isolation test.** Authenticated as user A, attempt to
read and to write every one of the 12 tables as user B. **All 24 attempts must
fail.** Written as an automated test, not a manual check.

---

### Phase 2 — Two parallel tracks

#### Track A · Dressing and interaction grammar

| # | Task |
|---|---|
| A2.1 | Monitors 1 and 2, keyboard, mug, notebook, phone, headphones |
| A2.2 | Bloom, dust motes, film grain, window rain — each behind its perf gate |
| A2.3 | `InteractiveObject` — hover, mobile arm-then-activate (3 s window), hidden 48×48 button, focus ring |
| A2.4 | Per-object focus poses; one object wired end to end before the rest |
| A2.5 | DOM overlay shell — corner allocation, right-hand 480 px slide-in panel |
| A2.6 | `capture-states` script |

**Gate:** re-run the lighting acceptance test with effects **on and off**. Every
interactive object is tab-reachable and activates with Enter/Space. Labels
suppress while a panel is open. Monitor 2 does not float 6 mm above the desk —
`04-room-spec.md` §1 documents this portfolio bug; fix it here.

#### Track B · Agents and the text surface

| # | Task |
|---|---|
| B2.1 | `lib/prompts/` — both templates, Zod schemas, ≥ 20 curated fallbacks |
| B2.2 | `AgentProvider` interface + `OpenAIProvider` |
| B2.3 | `/api/agent/extract` — SSRF guards, 8 s timeout, 6000-char cap, retry-once, fallback |
| B2.4 | `/api/agent/reflect` — **no request-body logging**, provider errors mapped to codes |
| B2.5 | Atomic rate limiting; 429 + `Retry-After` |
| B2.6 | `agent_logs` writes on every path |
| B2.7 | Hourly challenge seeder |
| B2.8 | `/text` route — all four features, no WebGL |
| B2.9 | PWA: manifest, service worker caching the `/text` shell |

**Gate:** a database dump after a full journal-with-reflection cycle contains
**no fragment** of the entry text (AC-3.2). Both agents return a usable result
with the provider network-blocked. `/text` bundle contains no three.js.

---

### Phase 3 — BBE mechanics · sequential, one at a time

Re-run the lighting acceptance test after **each** of these. This phase is where
the room is most likely to break.

| # | Task | Feature |
|---|---|---|
| 3.1 | Monitor 1 canvas texture + emissive 1.1→1.4 (D-20), hover lift clamped to 1.4. **Verify criterion 1 at 1.4**; lower the ceiling if the lamp pool loses primacy | F1 |
| 3.2 | Phone import panel + screen emissive during extraction | F1 |
| 3.3 | Monitor 2 canvas texture — goals + SVG timeline | F4 |
| 3.4 | Notebook journal panel + AI Insight block | F3 |
| 3.5 | Wall tracker — `InstancedMesh`, per-instance colour, only today bright | F2 |
| 3.6 | **The bonsai** — instanced leaves, `lib/growth.ts`, 180 ms droplet + 900 ms reveal | F2 |
| 3.7 | Window sky-plane state table keyed to `localHour` | ambient |
| 3.8 | Headphones focus-mode toggle + Tone.js ambient bed, **off by default** | ambient |

The bonsai is second to last on purpose.

**Gate:** every row of the state → surface table in `05-scene-state-contract.md`
§3 is wired and lerping. At rest pose, the wall grid reads as texture rather
than as countable data.

---

### Phase 4 — Hardening

| # | Task |
|---|---|
| 4.1 | Lighthouse CI with asserted budgets; performance ≥ 85 |
| 4.2 | `axe-core` + Playwright a11y smoke over `/`, `/text`, auth |
| 4.3 | Reduced-motion pass — every row of `03-motion.md` §"Reduced motion, concretely" |
| 4.4 | Empty states for every widget and panel (X-1) |
| 4.5 | Offline verification: airplane mode, `/text` usable, room renders from cache (an open room; D-22 §1) |
| 4.6 | Privacy Policy stating FR-3.6 plainly, including that entries are not retrievable |
| 4.7 | Provider spend cap (COST-1): met by the Gemini free tier with no billing attached (D-19 amendment, D-22 §7) |

---

### Phase 5 — The backlog, the extras and the door · scope set by D-24

Two tracks again, split as in Phases 1 and 2. Track B has no scene work and can
run beside all of Track A. Track A is sequential, lowest lighting risk first,
and the lighting acceptance test is re-run after **each** task, in all five sky
bands, effects on and off. Values below are **PROPOSED** unless they cite a
decision.

#### Track B · Account and limits

| # | Task |
|---|---|
| B5.1 | **Plans (D-24 §7).** A `user_plans` table — `user_id` primary key on `auth.users` with `on delete cascade`, `plan text not null default 'free' check (plan in ('free'))` — select-only to its owner, a row made by `handle_new_user()` and backfilled for existing users. Not a column on `profiles`: `own_profile` is `for all`, so a user could write it. The caps in `lib/prompts/index.ts` become per-plan, `free` holding today's 20 and 3, and `lib/agents/ops.ts` reads the caller's plan |
| B5.2 | **Account deletion (D-22 §5, D-24 §2).** A route under `app/api/` deletes the signed-in user through the service role (`auth.admin.deleteUser`), taking the id from the session and never from the body. The cascades remove every row; `agent_logs` keeps its rows with `user_id` null. The control lives in `AccountControl`, so it is on the room and `/text`; it arms, says what the next press does, and fires within `ARM_WINDOW_MS`. It clears the local snapshot and signs out. `/privacy` changes in the same commit |

**Gate:** `test:db` proves a user cannot change their own plan and that caps
follow the plan; after a deletion, no table holds a row carrying the deleted
id, and `agent_logs` rows remain with a null user. The isolation gate still
passes.

#### Track A · The room

| # | Task | Surface |
|---|---|---|
| A5.1 | **The window, glide only** (08 §4). Wrap it in `InteractiveObject`, `focusObject('window', null)`, the existing pose. No panel; back and Escape return. No scene transition follows: only the door has a second scene | room (ambient; no `/text` counterpart, as 3.7 had none) |
| A5.2 | **The two-minute timer** (spec/00, D-24 §6). Turning focus on starts it; at two minutes the bed fades out over 600 ms and focus turns off. The countdown shows beside the sound control in the corner — the headphones stay a toggle, with no panel (08 §4). A silent timer on `/text`. Not persisted, no chime, and under reduced motion the count still changes but nothing moves | both |
| A5.3 | **The mug's morning steam** (D-18). A few transparent sprites in the dawn band only, on the dust-mote precedent (`09-atmosphere.md`: opacity ≤ 0.08, no depth write), not emissive. Removed — not slowed — under reduced motion. A new spec/05 §3 row, `localHour` → steam | room (ambient) |
| A5.4 | **The daylit window** (12 §6 option 2, D-24 §9). The day band's sky brightens, and the rim light rises from 1.2 toward 2.5 at midday, lerped with the sky. Every sky value is luminance-checked against the 0.1 bloom threshold. The capture job gains pinned-hour captures (Playwright `timezoneId`) so both extremes are tested on every CI run, not only the runner's hour | room (ambient) |
| A5.5 | **The bonsai, rewired.** One droplet per new leaf, in sequence, not one shared; only a leaf earned in this session animates — a hydrate, a rehydrate on `online` or a sign-in elsewhere shows leaves at once; the droplet's path clears the top pad. A unit test for `lib/growth.ts` | both (`/text` shows the leaf count already) |
| A5.6 | **The bonsai, moved** (D-24 §5). Candidate spots to the right of or lower than `[-0.8, 0, 0.1]`, each measured by the lighting test until the pool peak is under 1 with no exception; the owner approves one on its screenshot, and D-11 gains the amendment note. The bonsai focus pose follows | room |
| A5.7 | **The door scene — design** (D-24 §8). A short design note for the owner before any code: the space, its light rig inside the five roles, and its own acceptance criteria. The full-size tree is the reworked bonsai at scale, so this follows A5.5 and A5.6 | — |
| A5.8 | **The door scene — build.** A hit disc on the door spill, a fade out of the room and into the scene (08 §4; a crossfade under reduced motion), back and Escape to return. The scene is its own chunk, loaded on the first entry, outside the shell budget (D-10). The history reads from `habit_logs`, `longest_streak` and the day grid through the store, never the network | room |
| A5.9 | **History on `/text`** (D-07). The same history as a list: each habit with its longest streak and its kept days. The longest streak is primary and resets are never announced (D-09) | `/text` |

The bonsai comes after the steam and the window here for the reason it came
second to last in Phase 3: it is the task most likely to break the lighting,
and it is followed only by the scene built around it.

**Gate:** the lighting acceptance test reads TRUE in all five sky bands, and
at noon and midnight, effects on and off, with the pool peak under 1 and no
accepted exception. The door scene passes the criteria its design note set.
`bundle:check` holds all three budgets with the scene split out. `a11y:check`,
`motion:check` and `offline:check` still pass, extended to the door scene and
the history view. Every row of spec/05 §3, old and new, is wired.

---

### Phase 6 — The UI rework · scope set by D-25

Owner-led. The agent captures before the review and builds after it; the
review between is the owner's. Values below are **PROPOSED** unless they cite
a decision.

| # | Task |
|---|---|
| 6.1 | **The review board** (D-25 §1). Every in-scope surface and state, captured from a production build against the local stack — signed out, and signed in as a throwaway user with a seeded year — at 1600 × 1000 and 390 × 844. Each item names the doc that governs it and any PROPOSED value still open. One private page, where the owner marks each item *keep*, *change* or *I'll design it*, with notes |
| 6.2 | **Reading the verdicts.** The board's marks, grouped into tasks 6.3 onward: one surface or one shared component each, smallest first. Items marked *I'll design it* wait for the owner's design (D-25 §4) |
| 6.3+ | **The changes,** one task per group, each answered on the board with captures from before and after |

**Gate:** every board item has a verdict and every verdict is closed — kept,
changed and re-captured, or built from the owner's design and approved on its
screenshot. D-07 holds on every change. `a11y:check`, `motion:check`,
`offline:check`, `lh:check` and `bundle:check` pass. The lighting test is
re-run for any change that touches the canvas or a token that drives an
emissive surface (D-20, D-21).

---

## 3. Definition of done

A task is not done until **all** of these hold. This list is the single most
useful thing to paste into an agent's task prompt.

1. `pnpm lint && pnpm lint:colors && pnpm typecheck && pnpm build` passes.
2. No hex literal outside the token palette. The only sanctioned exceptions are
   walnut (`#221811`, `#2C1F17`) and brass (`#B8860B`), and they are already spent.
3. If it touched anything that emits or blocks light — **the five-item lighting
   acceptance test was re-run** and a screenshot is attached to the PR.
4. If it touched the scene — no store subscription inside `useFrame`, and no
   scene object writes to a store.
5. If it touched a feature — it works on **both** the room and `/text`.
6. If it touched motion — it respects `prefers-reduced-motion` per the table in
   `03-motion.md`, which means *removed*, not reduced.
7. If it touched the database — RLS is on, and the cross-user isolation test
   still passes.
8. If it touched an agent — `agent_logs` is written on every path, including
   failure, and no user-facing error is possible.
9. It shows no negative number and no punitive state to the user (X-5, D-08, D-09).
10. Nothing in `01-decisions.md` marked LOCKED was worked around.

---

## 4. Guidance for parallel agents

**The tracks are genuinely independent.** Track A touches `scene/` and
`styles/`; Track B touches `app/api/`, `lib/` and `supabase/`. They meet only at
`lib/stores/` and `lib/growth.ts`, both defined in Phase 0 before either track
starts. That is the design — `05-scene-state-contract.md` exists so these two
workstreams do not need to talk.

**Do not let one agent hold both tracks in one phase.** The value of the split
is that the lighting work gets an uninterrupted run at the acceptance test while
the data work gets an uninterrupted run at RLS. Interleaving them produces a
room that half-passes and a schema that half-isolates.

**When something is ambiguous, check in this order:** `01-decisions.md` (is it
already decided?) → `../design-system/11-anti-patterns.md` (is it forbidden?) →
the relevant spec doc → ask the owner. Do not resolve an ambiguity by picking
whichever reading is easier to implement.

**Screenshot discipline.** `capture-states` exists so reviewers get a diffable
visual record instead of "looks fine on my machine". Run it on any PR that
touches the scene and attach the output. This was one of the two scripts that
kept the portfolio honest across five phases.
