# spec/ — The Functional Contract

**For:** Be Better Everyday (BBE)
**Companion to:** `../design-system/` (the visual contract)
**Written:** 2026-09-18

---

## What this folder is

`design-system/` says **how the product looks and behaves as a space.**
`spec/` says **what the product does.**

Neither is complete without the other. The design system was extracted from a
shipped portfolio project and is proven; this folder is the BBE application
layered onto it. Where the two disagree, `01-decisions.md` records which one
won and why — **read that before installing a single dependency.**

---

## Reading order

| # | file | read when |
|---|---|---|
| 00 | `00-product-brief.md` | **always, first.** What BBE is, who it is for, the thesis, what is explicitly out of scope. |
| 01 | `01-decisions.md` | **always, second.** The decision log — twenty locked decisions, no open questions. Ignoring this is how you end up installing Tailwind. |
| 02 | `02-features.md` | building any feature. Four features, user stories, functional requirements, acceptance criteria, and which room object each one binds to. |
| 03 | `03-data-model.md` | touching the database. Schema, RLS policies, the points ledger, migration order. |
| 04 | `04-ai-agents.md` | touching anything AI. Three agent contracts, prompt templates, output schemas, rate limits, fallbacks, observability. |
| 05 | `05-scene-state-contract.md` | **the integration seam.** The typed contract between application state and the 3D room. Both the data work and the scene work depend on this file, and neither owns it. |
| 06 | `06-build-plan.md` | planning or picking up work. Repo structure, phases, task breakdown, verification gates. |
| 07 | `07-first-session.md` | **picking this project up for the first time.** Repo state, outstanding setup steps, how the project is tooled (and why there is no spec-driven-development framework), and a session-one checklist. |

And from the design system, in parallel:

| read this | before doing this |
|---|---|
| `../design-system/00-aesthetic-thesis.md` | anything at all |
| `../design-system/11-anti-patterns.md` | proposing any UI pattern |
| `../design-system/04-room-spec.md` | touching scene geometry |
| `../design-system/05-lighting-rig.md` | touching any light — contains the acceptance test |
| `../design-system/12-habit-tracker-adaptation.md` | building any of the room's BBE mechanics |

---

## Status legend

Every claim in this folder carries one of three statuses. Respect them.

- **LOCKED** — decided, and not up for re-litigation by an implementing agent.
  If you believe a LOCKED decision is wrong, raise it with the owner and get
  `01-decisions.md` amended. Do not route around it in code.
- **PROPOSED** — a reasoned default that the owner has not yet ratified. Build
  against it, but flag it in your PR description so it gets a real decision.
- **OPEN** — genuinely undecided. Do not guess. Ask.

The design system uses the same idea: documents 00–11 are extracted fact from a
shipped project, document 12 is the BBE adaptation, now revised and locked.

---

## The one-paragraph orientation

BBE is a personal-growth PWA whose premise is that people save far more
self-improvement content than they ever act on. It converts saved articles into
two-minute micro-actions, tracks habits, supports a low-friction journal, and
shows goals on a timeline. Its interface is not a dashboard — it is a dark,
quiet 3D room, reused from the owner's portfolio project, in which each feature
is a physical object on a desk. You click the phone to import an article. The
amber monitor shows today's challenge and literally brightens the room when you
complete it. A bonsai on the desk grows a leaf for each habit completion and
never, under any circumstance, wilts.

---

## Non-negotiables, if you read nothing else

1. **No Tailwind, no shadcn/ui, no Inter, no light mode.** All four appear in
   the original SRS and all four are overruled. See `01-decisions.md` D-01 to D-04.
2. **The 3D scene reads from a store, never from the network.** A data layer
   writes into the store; the scene observes it inside `useFrame` via
   `getState()`. See `05-scene-state-contract.md`.
3. **Nothing in this product punishes the user.** No streak-shaming, no wilting
   plant, no red counters, no confetti either. Absence of growth is the only
   signal a missed day gets. See `../design-system/11-anti-patterns.md`.
4. **Every colour comes from the token palette.** A colour lint enforces it in
   CI and it ships in Phase 1, not later.
5. **The `/text` route is not a fallback, it is a first-class surface.** It is
   the mobile fast path and the offline shell. See `01-decisions.md` D-07.
