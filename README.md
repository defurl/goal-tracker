# Be Better Everyday

A personal-growth PWA whose interface is a dark, quiet 3D room. Each feature is
a physical object on a desk: you click the phone to import an article, the amber
monitor shows today's two-minute challenge and brightens the room when you
complete it, and a bonsai grows a leaf for each habit you keep.

Its premise is that people save far more self-improvement content than they ever
act on. So the product converts saved articles into micro-actions, and the room
becomes the record of having done them.

> *"The same 3 a.m. desk — but every object on it is evidence that you acted on
> something you saved."*

**Status:** specification complete, implementation not started.

---

## Repository layout

| path | what it holds |
|---|---|
| `CLAUDE.md` | instructions for AI agents working in this repo — start here |
| `spec/` | the functional contract: features, data model, AI agents, build plan |
| `design-system/` | the visual contract: the 3D room, extracted from a shipped portfolio project |

Read `spec/README.md` for the reading order across both folders.

---

## The four features

**Action Launcher & Daily Challenge** — paste a URL, an AI agent extracts one
concrete action you can do in under two minutes. One is surfaced each day.

**Glow-up Habit Tracker** — habits tagged as things you are building or things
you are quitting. Completions grow the bonsai and light a cell on the wall.

**Smart Journal** — mood, tags, and an opt-in AI reflection. Entry text is never
stored; only the summary survives.

**Goal Dashboard** — goals broken into milestones on a timeline.

---

## Two things worth knowing about the design

**Nothing punishes the user.** No negative points, no streak-shaming, no wilting
plant — and no confetti either. A missed day gets one signal: nothing grows.

**Journal entries are not retained.** After the AI reflection runs, the original
text is gone. The database has no column capable of holding it. You get the mood,
the tags and the insight; you do not get to re-read what you wrote. That is a
deliberate trade and the onboarding says so.

---

## Stack

Next.js 14 (App Router) · React Three Fiber · Supabase (Postgres + Auth + RLS) ·
OpenAI `gpt-4o-mini` · CSS Modules · Vercel

Notably **not** used, and for documented reasons — see `spec/01-decisions.md`:
Tailwind, shadcn/ui, Inter, and any light mode.

---

## Getting started

Not yet buildable — Phase 0 of `spec/06-build-plan.md` is the scaffold step.

```bash
cp .env.example .env.local   # then fill it in
```

## License

Not yet chosen.
