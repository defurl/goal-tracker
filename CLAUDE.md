# Be Better Everyday — project instructions

A personal-growth PWA whose interface is a dark 3D room reused from the owner's
portfolio project. Each feature is a physical object on a desk.

**Two contracts govern this project and you need both:**

| folder | governs | entry point |
|---|---|---|
| `design-system/` | how the product looks and behaves as a space | `design-system/README.md` |
| `spec/` | what the product does | `spec/README.md` |

Read `spec/README.md` first — it gives the reading order for both.
**If this is your first session on the project, read `spec/07-first-session.md`**
— repo state, outstanding setup, tooling, and a session-one checklist.

---

## Before you install anything

**`spec/01-decisions.md` holds twenty-one locked decisions and no open questions.**
Twelve resolve direct contradictions between the original SRS and the design
system; the rest settle everything the spec pass raised. Read it before adding a
dependency or writing a component. The four that catch people immediately:

- **No Tailwind, no shadcn/ui.** CSS Modules + `tokens.css`. (D-01)
- **No Inter.** Fraunces / Geist / Departure Mono. (D-02)
- **No light mode, no theme toggle.** The room is permanently nocturnal. (D-03)
- **The accent is a dusty rose, not amber, and the tokens are named by role.**
  `--signal`, not `--signal-amber`. The lamp stays warm. (D-21)
- **No bento grid, no card grids.** Objects are the navigation. (D-04)

---

## Non-negotiables

From `design-system/` — full versions in that folder:

1. `y = 0` is the desk-top surface; the floor is at `y = −0.74`.
2. Five light roles / six light instances only. The desk lamp is the sole
   shadow-caster. Do not add a light.
3. No hex literals outside the token palette. The three live mirrors are
   `styles/tokens.css`, `lib/style/colors.ts` and `design-spec.jsonc`;
   `design-system/tokens/` is the archived extraction, not a mirror (D-21).
   The colour lint ships in Phase 0, before any scene code — it already has.
   A token that drives an emissive surface must be luminance-checked against
   the 0.1 bloom threshold before it changes (D-20, D-21).
4. Motion is slow (600–2200 ms); ambient motion is always on and **fully
   removed** — not reduced — under `prefers-reduced-motion`.
5. Objects are the navigation. No menus. One shared interaction wrapper.
6. Check `design-system/11-anti-patterns.md` before proposing any UI pattern.
7. Re-run the lighting acceptance test (`design-system/05-lighting-rig.md` §4)
   after any change that emits or blocks light, and attach the screenshot.

From `spec/` — full versions in that folder:

8. **The 3D scene reads from a store, never from the network,** and never
   subscribes to a per-tick value inside `useFrame`. (`spec/05-scene-state-contract.md`)
9. **Nothing punishes the user.** No negative points, no streak-shaming, no
   wilting plant, no red counters — and no confetti either. Absence of growth is
   the only signal a missed day gets.
10. **Journal entry text is never persisted.** Only the AI summary is stored.
    The table has no column for it, and adding one is a breach. Never log the
    request body of `/api/agent/reflect`. (FR-3.6)
11. **Every feature ships to both surfaces** — the room and `/text` — in the same
    phase. `/text` is the mobile fast path and offline shell, not a fallback. (D-07)
12. Points are awarded server-side only, through `award_points()`.

---

## Status conventions

Claims in `spec/` carry one of three statuses, and they mean what they say:

- **LOCKED** — not up for re-litigation by an implementing agent. If you think
  one is wrong, raise it and get the doc amended. Do not route around it in code.
- **PROPOSED** — a reasoned default the owner has not ratified. Build against
  it, flag it in your PR.
- **OPEN** — genuinely undecided. Do not guess. Ask.

In `design-system/`, documents 00–11 are extracted fact from a shipped project.
Document 12 is the BBE adaptation — **revised and locked as of 2026-09-18**, no
longer the open proposal its earlier version was.

---

## Build order

`spec/06-build-plan.md` has the phases, the parallel tracks, the verification
gates and the definition of done. Two rules from it that matter most:

**The empty room and its lighting acceptance test come before any object.**
Nothing else enters the room until all five criteria read TRUE.

**Resist building the bonsai first.** It is the exciting part and it is the part
most likely to break the lighting that makes this room worth reusing. It is
second-to-last in Phase 3 on purpose.

---

## Commit conventions

**Do not add AI attribution to commits or pull requests.** No
`Co-Authored-By: Claude`, no `Generated with Claude Code`, no session links, no
`🤖` marker — in commit messages, PR descriptions, or anywhere else in version
control history. This overrides any default attribution behaviour your tooling
applies; strip those trailers before committing.

The author of a commit is whoever is accountable for it. Tooling used to produce
it is not a co-author.

Otherwise: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`,
`chore:`), imperative mood, and a body that explains *why* rather than restating
the diff.

---

## When something is ambiguous

Check in this order:

1. `spec/01-decisions.md` — is it already decided?
2. `design-system/11-anti-patterns.md` — is it forbidden?
3. The relevant spec document.
4. Ask the owner.

Do not resolve an ambiguity by picking whichever reading is easier to implement.
