# Progress

> **This is the session-to-session state handoff.** `spec/07-first-session.md` §2
> names it as the one genuine gap that no document currently covers: without it,
> session three re-derives what session two decided.
>
> Chosen mechanism: **this file**, over GitHub issues per build-plan task. It
> works offline, it is reviewed in the same diff as the code it describes, and it
> costs one edit per session. If the project later grows past what a single file
> can carry, move to issues — but move, do not run both.
>
> **Update it at the end of every session**, before the last commit. An entry
> records what changed, what is now true, and what the next session should pick
> up. It is not a changelog: `git log` is the changelog. This is the state.

---

## Where the project is

**Phase 0 — Foundation: complete.** The gate is green and there are no open
decisions. Phase 1 may start.

Nothing is in the room yet, and per `spec/06-build-plan.md` nothing goes in it
until the five-item lighting acceptance test reads TRUE.

### Phase 0 gate — verified 2026-09-18

```
pnpm lint         clean
pnpm lint:colors  clean (18 files, 17 palette values)
pnpm typecheck    clean
pnpm build        5 static routes, shell 87.9 KB gz / 200 KB budget
pnpm bundle:check both budgets green; shell free of three.js
```

The second half of the gate — "a deliberately introduced hex literal fails the
build" — was run locally and is asserted on every CI run by the
`colour-lint-self-test` job in `.github/workflows/ci.yml`. It writes an
off-palette hex into `styles/` and fails if `lint:colors` passes.

---

## Session log

### 2026-09-18 — thesis, mood anchors, data-red closed

All three items carried as "outstanding" in the previous entry were already
answered by the owner; they were held open by asking for confirmation that had
been given. Closed now.

**Thesis — amended, D-14.** The time clause is dropped. Operative sentence:

> "The habit tracking desk: every object on it is evidence that you acted on
> something you saved."

"3 a.m." imported the portfolio's mood along with its room, and the mood is the
part BBE does not inherit (D-21). The room is still nocturnal — D-03 is a
lighting fact, not a statement about the product's register. The judgeable half
of the sentence is unchanged, which is the half that does the work. Applied to
`spec/00-product-brief.md` §1, D-14's amendment note, and `design-spec.jsonc`.

**Mood anchors — removed, not replaced.** Five of the portfolio's six survived
the earlier pass. All six were written for a late-night quant terminal in a
voxel city. The block is gone and `design-spec.jsonc` carries a comment saying
why, and that anchors go back only if the owner writes them. The thesis is now
the single register statement, which is what `00-aesthetic-thesis.md` asks for
anyway.

**`--data-red` — closed as moot, value unchanged.** Raised because a muted red
sits close to the rose accent. In practice BBE renders it nowhere: every
reference in the repo is a token declaration or a rule forbidding its use to
judge the user. D-08 deleted the negative points, D-09 resets streaks silently,
and no feature produces negative live data. Deepening a colour that never
reaches a pixel is motion without movement. The token stays so a future feature
has something to re-check.

**Also reconciled** the decision counts that had drifted across `CLAUDE.md`,
`spec/README.md`, `spec/07-first-session.md` and `01-decisions.md` — all now say
twenty-one, no open questions. That was the second doc inconsistency logged in
the Phase 0 entry; both are now cleared.

**Known gap, not fixed:** nothing validates that `design-spec.jsonc` is
parseable. `lint:colors` is regex-based and the build never reads the file, so a
syntax error in the third mirror would pass every check silently. Worth folding
a parse into `lint:colors` or `lint:contract`.

---

### 2026-09-18 — palette adaptation (D-21)

**Decided by the owner.** Adapt the inherited 3D scene, not the inherited mood.
The room stays nocturnal (option 1 of `12-habit-tracker-adaptation.md` §6, so
D-03 is untouched and the lighting rig and its acceptance test carry over
unchanged). The register stays simplicity — no reward moment, which is what D-05
and the register lock already said.

**Done**

- Six palette values and five token names changed. `--signal*` replaces
  `--signal-amber*`, `--glow-cool*` replaces `--voxel-glow*`. Accent tokens are
  now named by role, so the next hue change is a value edit, not a repo sweep.
- Swept the three live mirrors, `styles/globals.css`, four spec documents and
  `design-system/12-*`. Left `design-system/` docs 00–11 and `tokens/` as the
  frozen extraction, with a superseding pointer at the top of `01-color-palette.md`
  and a one-line note on the label CSS in `02-typography.md` (that block is meant
  to be copied verbatim and would otherwise paste a dead variable).
- `CLAUDE.md` non-negotiable 3 now points at the live mirrors rather than
  `design-system/tokens/`, and carries the luminance rule.

**Two things the lint caught, both worth knowing**

1. **The first rose fell below the bloom threshold.** `--signal-dim` drives
   monitor 1's emissive and the bloom pass thresholds at 0.1. The first
   candidate measured 0.074 at emissive 1.1 — the monitor would have sat flat
   for most of every day. That is D-20's failure in a new hue. Shipped value
   measures 0.126. The rule is now written into D-21 and into the header of
   `lib/style/colors.ts`.
2. **`lint:colors` was allowlisting its own documentation.** `loadPalette` read
   every hex in `colors.ts`, so a rejected candidate mentioned in a *comment*
   silently became an allowed colour. It now matches only
   `export const NAME = '#RRGGBB'`. Verified: the rejected value is rejected.

**Gate re-run after the change** — `lint`, `lint:colors` (17 palette values),
`typecheck`, `build`, `bundle:check` (shell 87.9 KB gz, free of three.js): green.

**Outstanding at the time — all three closed in the entry above.**

---


### 2026-09-18 — Phase 0

**Done**

| task | where |
|---|---|
| 0.1 Next.js 14 App Router, TypeScript 5.6, pnpm, `.nvmrc` | `package.json`, `tsconfig.json`, `next.config.mjs` |
| 0.2 all three palette mirrors | `styles/tokens.css`, `lib/style/colors.ts`, `design-spec.jsonc` |
| 0.3 `lint:colors` + CI wiring | `scripts/lint-colors.ts`, `.github/workflows/ci.yml` |
| 0.4 fonts | `app/layout.tsx` (Fraunces, Geist) — Departure Mono outstanding, see below |
| 0.5 `globals.css` | `styles/globals.css` |
| 0.6 empty zustand stores | `lib/stores/{app,interaction,scene}.ts` |
| 0.7 ESLint 9 flat config, Husky, commitlint | `eslint.config.mjs`, `.husky/`, `commitlint.config.mjs` |
| 0.8 `bundle:check`, both D-10 budgets | `scripts/bundle-check.ts` |

**Outstanding — carry into the next session**

1. **`public/fonts/DepartureMono-Regular.woff2` is not in the repo.** It is free
   but not on npm, so nothing installs it. The `@font-face` and the fallback
   chain are already wired, so the build is green without it — but the mono face
   is wrong until someone downloads it. See `public/fonts/README.md`. This is
   the only incomplete part of task 0.4.
2. **`lint:contract`** — `spec/07-first-session.md` §3 recommends extending the
   colour lint to cover D-01 (no Tailwind/shadcn), D-02 (no Inter), D-03 (no
   light mode) and D-05 (no hardcoded ms). Roughly sixty lines, and it converts
   four documented rules into build failures. Open as a follow-up, as §3 asks.
3. **`.claude/commands/lighting-test` and `/dod`** — `spec/07-first-session.md`
   §2 asks for the two repeatable rituals to be invocable by name rather than
   skimmed. Cheap; not yet written.

**Deviations from the plan, and why**

- **`@next/eslint-plugin-next` is on `^15`, not `^14`.** The 14.2 plugin calls
  `context.getAncestors()`, removed in ESLint 9, and crashes the lint. 15.x is
  the ESLint 9-compatible build of the same rules. This is a lint plugin only —
  **the framework stays on Next.js 14 per D-06.**
- **No `tsx`.** Node 24 strips TypeScript types natively, so the two scripts run
  under plain `node`. One fewer dependency and one fewer native binary in CI.
  This is why `package.json` sets `"type": "module"`.
- **`.nvmrc` pins Node 24**, which is what the gate was verified against.
  `engines` allows >= 22.11.

**Doc inconsistencies found — not fixed, they need an owner decision**

- `spec/01-decisions.md` D-06's carry-over table says `lint:colors` ships in
  **Phase 1**. `CLAUDE.md`, `spec/06-build-plan.md` (task 0.3) and
  `spec/07-first-session.md` all say **Phase 0**. Built in Phase 0, with the
  three against one. D-06 is LOCKED, so the table needs an amendment note rather
  than an edit — `spec/01-decisions.md`, "Amending this file".
- `spec/01-decisions.md` says "All twenty are LOCKED" at the top and "D-01 to
  D-19 are the complete set" under *Open questions*. `spec/07-first-session.md`
  §3 still says "Nineteen locked decisions". D-20 landed after those lines were
  written.

**Next**

Phase 1, both tracks — `spec/06-build-plan.md` §2. Track A starts at A1.1 and
does not deviate from the order. Do not let one agent hold both tracks (§4).
