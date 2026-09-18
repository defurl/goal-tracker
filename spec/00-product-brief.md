# 00 — Product Brief

> Status of this document: **LOCKED** unless marked otherwise inline.
> Source: `Be_Better_Everyday_SRS.docx` v1.0 (Sept 2026), reconciled against
> `../design-system/`. Where they conflicted, see `01-decisions.md`.

---

## 1. The thesis

`../design-system/00-aesthetic-thesis.md` requires a one-sentence thesis that
every design decision is judged against, and explicitly forbids reusing the
portfolio's quant-terminal sentence. Here is BBE's:

> **"The habit tracking desk: every object on it is evidence that you acted
> on something you saved."**

Status: **LOCKED** — ratified by the owner 2026-09-18, amended the same day to
drop the time-of-day clause (`01-decisions.md` D-14).
Judge every design proposal against this sentence; if one cannot be defended
against it, it does not belong in the project.

Why this sentence: it names the desk and nothing else, because "3 a.m." imported
the portfolio's mood along with its room. The room is still nocturnal (D-03) —
that is a lighting fact, not the product's register. BBE's product insight is
*"knowledge stored is not knowledge applied."* The room's mechanic is *evidence of consistency accumulating in the
furniture.* Those are the same idea seen from two directions, which is the
reason this room is the right shell for this product rather than an arbitrary
skin on a habit tracker.

### The two register decisions doc 00 demands

**Time of day — LOCKED: stay nocturnal.**
The room is permanently 3 a.m. The window's sky plane still shifts with real
local time, so the room acknowledges morning without becoming bright. This is
option 1 of the three in `../design-system/12-habit-tracker-adaptation.md` §6
and the only one that preserves the five-light rig exactly as documented. A
daylit window (option 2) is a Phase 2 candidate; a full day cycle (option 3) is
out of scope and should not be attempted before the nocturnal version ships.

**Emotional register — LOCKED: quiet accountability, never punishment.**
A habit tracker touches streaks, misses and guilt, and this one refuses to
trade on any of them. Growth is additive and slow. Absence reads as quiet —
never as decay. Concretely this forbids: wilting or browning the bonsai,
removing leaves, red counters, "you broke your streak" copy, and any sound or
animation that marks a miss. It equally forbids the opposite failure —
confetti, badge pops, achievement chimes. The reward is the accumulated room,
not the moment. See `../design-system/11-anti-patterns.md`.

---

## 2. What BBE is

An AI-augmented, action-first personal growth PWA. Its premise: people
accumulate self-improvement content and almost never act on it. BBE shrinks the
gap between saving an idea and doing something with it.

| | |
|---|---|
| **Target users** | Young adults (18–35) pursuing personal productivity and wellness |
| **Delivery** | B2C · web-first PWA, installable, offline-capable |
| **Interface** | A 3D room (see `../design-system/`), plus a `/text` fast path |
| **AI role** | Three stateless agents: content extraction, journal analysis, challenge generation |
| **MVP scope** | Four features, no native app store dependency |
| **Phase 1 scale** | < 500 concurrent users, $20/day hard AI spend cap |

### The four problems it addresses

**Productivity illusion syndrome.** Users bookmark and "like" hundreds of tips
and act on almost none.

**Friction overload.** Turning a saved article into a concrete daily action
takes too many manual steps.

**Motivation decay.** Habit trackers without a visible reward loop lose users
within roughly two weeks.

**Reflection gap.** Journaling apps are either a blank canvas (anxiety) or a
fixed prompt list (rigid).

### The four features that address them

| # | Feature | Priority | Binds to room object |
|---|---|---|---|
| F1 | Action Launcher & Daily Challenge | P0 | Monitor 1 (warm) + Phone (import) |
| F2 | Glow-up Habit Tracker | P0 | Bonsai (desk) + back wall grid |
| F3 | Smart Journal | P1 | Notebook |
| F4 | Goal Dashboard | P1 | Monitor 2 (cyan) |

Full specifications in `02-features.md`.

---

## 3. The room, in one table

The complete object mapping, agreed 2026-09-18. Authoritative version lives in
`../design-system/12-habit-tracker-adaptation.md` §2; reproduced here so this
brief stands alone.

| Object | Position | BBE role |
|---|---|---|
| Monitor 1 "primary" (warm) | `[-0.3, 0.306, -0.4]` | **Daily Challenge.** Today's action card. Emissive 1.1 → 1.4 on completion. |
| Monitor 2 "terminal" (cyan) | `[0.5, 0.27, -0.4]` | **Goal Dashboard.** Goals with progress and target dates. |
| Phone | `[0.7, 0, -0.1]` | **Article Import.** URL → AI extraction → challenge. |
| Notebook | `[-0.4, 0, 0.05]` | **Smart Journal.** Mood, tags, opt-in AI reflection. |
| Bonsai (replaces plant) | `[-0.8, 0, 0.1]` | **Glow-up Points.** One leaf per threshold. Never wilts. Capped 0.35 m. |
| Back wall panel grid | centre `x = -0.75, y ≈ 0.493` | **Habit Tracker.** 7 × N emissive quads, one per day. |
| Headphones | `[0.85, 0.045, 0.15]` | **Focus Mode toggle.** Two-minute timer. |
| Window | `[1.98, 1.0, -0.3]` | **Time of day.** Sky plane keyed to local time. |
| Door spill | `[-1.0, -0.73, 0.3]` | **Streak history.** Route to second scene. Phase 2. |
| Lamp | `[-0.95, …]` | Key light. Unchanged. Not interactive. |
| Keyboard, mug | — | Dressing. Mug gains a morning steam wisp in **Phase 2** (D-18). |

---

## 4. Explicitly out of scope for MVP

Listing these matters as much as listing what is in — an agent with spare
capacity will otherwise build them.

- Native mobile apps (iOS/Android). PWA only.
- Social features of any kind: sharing, friends, leaderboards, public profiles.
- Draggable / user-rearrangeable dashboard widgets (SRS §7.2 marks this Phase 2).
- The second 3D scene behind the door spill (streak history). Phase 2.
- Multi-turn AI conversation or any long-running agent. All agents are stateless,
  single-call, structured-output. See `04-ai-agents.md`.
- A light mode. See `01-decisions.md` D-03.
- Notifications and reminders beyond storing a `reminder_time` on a habit.
  The schema carries the field; nothing sends anything in Phase 1.
- Payment, subscription, or any monetisation surface.
- `gpt-4o` or any model above `gpt-4o-mini`. See `04-ai-agents.md` COST-2.

---

## 5. Glossary

Use these terms exactly; they appear in table names, store keys and copy.

| term | meaning |
|---|---|
| **Micro-action** | A concrete task doable in under two minutes, extracted by AI from an article. Starts with an imperative verb. ≤ 40 words. |
| **Daily Challenge** | The one micro-action surfaced to the user today, seeded at local midnight from their pending action library. |
| **Roll Again** | Replacing today's challenge with a different pending action. |
| **Glow-up Points** | The single cumulative score. Awarded by the ledger in `03-data-model.md` §4. |
| **Build habit** | A habit the user is adding (e.g. "read 10 pages"). +10 pts. |
| **Break habit** | A habit the user is quitting (e.g. "no phone in bed"). Completing = successfully avoided. +15 pts. |
| **Perfect Day** | ≥ 80 % of today's due habits completed. +25 pts. |
| **AI Insight** | The journal analysis agent's output. Always visually separated from the user's own writing. |
| **The room** | The 3D scene. The primary interface. |
| **The text route** | `/text`. Non-WebGL surface, mobile fast path, offline shell. Not a downgrade — see `01-decisions.md` D-07. |
| **Rest pose** | The room's default camera position, from which nothing is focused. |
| **Focus pose** | A per-object camera position the rig glides to when that object is activated. |
