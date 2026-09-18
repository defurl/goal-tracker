# 07 — First Session (agent team onboarding)

> For the Claude Code team picking this project up. Read `README.md` in this
> folder first for the reading order; this document covers what to do in the
> first session and how this project is tooled.

---

## 1. What you are inheriting

A docs-only repository. **No application code exists yet.**

| | |
|---|---|
| Remote | `https://github.com/defurl/goal-tracker.git` (public) |
| Branch | `main` |
| Initial commit | `a309984` — design system + spec, 62 files |
| State | working tree clean, nothing pushed yet |

### Outstanding setup steps

The initial commit was made from a sandboxed Linux mount that blocks file
deletion, which left two artefacts behind and could not push.

**The initial commit needs amending before it is pushed.** It carries AI
attribution trailers, which this repository does not use (see `CLAUDE.md`,
"Commit conventions"), and its author email should be confirmed.

```bash
cd D:\CODE\habit-tracker

# 1. A stuck lock file. Git writes will fail until this is gone.
rm -f .git/index.lock

# 2. ~71 orphaned temp objects. Harmless, but clutter.
find .git/objects -name 'tmp_obj_*' -delete

# 3. Set the identity this repository should carry.
git config user.name  "<name>"
git config user.email "<address — see below>"

# 4. Amend the initial commit: reset the author, strip the AI trailers.
git commit --amend --reset-author

#    In the editor, delete these two lines from the message:
#      Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
#      Claude-Session: https://claude.ai/code/...

# 5. Commit the outstanding spec changes.
git add -A
git commit -m "docs: correct monitor 1 emissive range; add first-session guide"

# 6. Push.
git push -u origin main
```

**On the author email.** The initial commit was authored as
`Hieu Tran <hieu.tran@audacy.com>` — a work address, which the owner has
decided should not appear in this repository's history. Step 3 sets a personal
address instead; the owner supplies it. Do not push until the amend in step 4
has replaced the author on `a309984`.

---

## 2. Tooling: no spec-driven-development framework

**Decision: do not adopt Spec-Kit, BMAD, or an equivalent framework for this
project.** Use Claude Code's own primitives.

This is a judgement call, not a rule, and the reasoning is worth having so it
can be revisited honestly if the project grows.

### Why not

Those frameworks are good, actively maintained, and mainstream as of late 2026.
The argument against them here is not that they are bad — it is that their
primary output is **the set of artifacts this repository already contains**,
and regenerating it would cost the thing that makes it valuable.

Spec-Kit's workflow produces a constitution, a spec, a plan and a task
breakdown. Compare:

| Spec-Kit artifact | already here |
|---|---|
| `constitution` (governing principles) | `design-system/00-aesthetic-thesis.md` + `11-anti-patterns.md` + `spec/01-decisions.md` |
| `spec` (requirements, user stories) | `spec/02-features.md` — stories, FRs, and acceptance criteria |
| `plan` (technical approach) | `spec/03-data-model.md`, `04-ai-agents.md`, `05-scene-state-contract.md` |
| `tasks` (actionable breakdown) | `spec/06-build-plan.md` — phases, parallel tracks, verification gates |

Both frameworks do support brownfield adoption, so this is not a technical
blocker — Spec-Kit ships an "evolving specs" guide precisely for this. The cost
is subtler: the value in these documents is that they are **reconciled against a
real extracted design system**. A generic template cannot know that object work
must be gated on a five-item lighting acceptance test, or that `--data-green` is
reserved for live data and therefore cannot colour a mood calendar. Regenerating
into a framework's format would either discard that reconciliation or leave two
parallel document sets to drift apart. Two sources of truth is a worse problem
than no framework.

One honest correction to the usual objection: BMAD in its current form is
considerably lighter than its reputation — skills-based, "right-sized for the
work in front of you", not the heavy six-persona pipeline it is often described
as. So "too heavy for this scope" is a weaker argument than it looks. The
redundancy argument above is the real one.

### What those frameworks give you that you still want

Four things, each available natively:

**Per-task context routing** — an agent needs to know which documents apply to
the task in hand. `CLAUDE.md` does this; keep it current as the surface area
grows, and keep it short enough to actually be read.

**Session-to-session state handoff.** This is the genuine gap, and the one thing
worth building. Nothing currently records *where the project is*. Frameworks
solve it with story files carrying status. Either a small `PROGRESS.md` that
each session updates, or GitHub issues per build-plan task, works — pick one and
be consistent. Without it, session three re-derives what session two decided.

**Repeatable rituals** — the lighting acceptance test and the ten-item definition
of done both get run repeatedly and both are easy to skip. Make them commands in
`.claude/commands/`: `/lighting-test` and `/dod`. Cheap to write, and it turns a
checklist someone might skim into something invoked by name.

**Role separation** — the two parallel tracks in `06-build-plan.md` map cleanly
onto subagents. One holds the scene context (geometry, lighting, materials); one
holds the data context (schema, RLS, agents). They meet only at
`05-scene-state-contract.md`, which is why the split works. Do not let one agent
hold both tracks in a phase — see `06-build-plan.md` §4.

---

## 3. Make the contract mechanical

**The most useful thing this project can do in Phase 0.**

For an agent team, the failure mode is not missing structure. It is an agent
that reads `CLAUDE.md`, feels informed, and installs Tailwind anyway because it
skimmed. Twenty-one locked decisions in a 20 KB file is more than any single
session reliably internalises.

So the question that matters is: **which decisions fail the build, and which
rely on someone noticing?**

### Already mechanical

| decision | enforced by |
|---|---|
| Palette discipline | `lint:colors` — fails on any hex outside the tokens |
| D-08 no negative points | `CHECK (points_awarded >= 0)` |
| FR-3.6 journal text never stored | the table has no column for it |
| D-10 bundle budgets | `bundle:check`, both budgets asserted separately |
| D-07 `/text` free of three.js | CI assertion on the entry bundle |
| RLS isolation | the 24-attempt cross-user test |

### Currently documentation only

| decision | machine-checkable? |
|---|---|
| D-01 no Tailwind / shadcn | **yes** — assert against `package.json` |
| D-02 no Inter | **yes** — grep font imports and `font-family` declarations |
| D-03 no light mode | **mostly** — grep for `prefers-color-scheme: light`, `#FFFFFF` |
| D-05 motion durations | **mostly** — flag hardcoded `ms` values outside the tokens |
| D-13 distress path | **yes** — fixture test against the agent with sample entries |
| D-04 no card grids | no — needs review |
| D-09 silent streak reset | no — needs review |
| the 5 % rule / rest-pose legibility | no — needs `capture:states` and eyes |

**Recommendation:** extend `lint:colors` into a single `lint:contract` script
covering D-01, D-02, D-03 and D-05. It is perhaps sixty lines and it converts
four documented rules into build failures. That is worth more to this project
than any framework, because it removes the need for an agent to have remembered
anything.

The three that cannot be linted are exactly what human review is for. Say so in
the PR template rather than hoping.

---

## 4. Session one checklist

1. Read `spec/README.md`, then `spec/01-decisions.md` in full. Not skimmed — the
   decisions are the part that is expensive to rediscover.
2. Complete the three git steps in §1, after confirming the author email.
3. Pick the state-handoff mechanism (§2) and create it.
4. Start **Phase 0** of `06-build-plan.md`. It is a single track and it blocks
   everything, so keep it tight.
5. Ship `lint:colors` in Phase 0 as the build plan requires, and open a follow-up
   for `lint:contract` (§3).

Then stop and get the Phase 0 gate signed off — `pnpm lint && pnpm lint:colors
&& pnpm build` green on an empty app, and a deliberately introduced hex literal
failing the build — before any scene or schema work begins.

---

## 5. One instruction worth repeating

From `06-build-plan.md`, and it is the thing most likely to be ignored:

> **The empty room and its lighting acceptance test come before any object.**
> **Resist building the bonsai first.** It is the exciting part and it is the
> part most likely to break the lighting that makes this room worth reusing.

The room is a working, tuned artefact lifted from a shipped project. It is the
main asset this product inherits, and it is easier to break than to rebuild.
