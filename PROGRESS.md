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

**Phase 1 track A — the empty room is built; the lighting gate is NOT signed
off.** Shell, Ando detailing, desk, the five-light rig, the camera rig and the
two perf/motion hooks are in. Two of the five acceptance criteria measurably
pass, one is marginal and two cannot be evaluated yet — see the entry below.
**Per the build plan, no object enters the room until all five read TRUE**, so
track A is paused pending an owner call on the two that reference objects which
do not exist at this point in the order.

Track B (data foundation) is untouched: it needs a Supabase project, and
`06-build-plan.md` §4 forbids one agent holding both tracks.

Phase 0 is now fully discharged — all five star artefacts exist.

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

### 2026-09-18 — the two missing Phase 0 artefacts, and an atomic-commit rule

`CLAUDE.md` now requires small atomic commits with proportionate messages. The
Phase 1 track A commit bundled six independent pieces behind a message long
enough to be a session report — immutable, unrevertable in parts, and nobody
re-reads it. Findings belong here, where they can be corrected.

**All five star artefacts from `06-build-plan.md` §1 now exist.** The two that
were missing:

- **`lib/growth.ts`** — `leafCountForPoints`, the single derivation of leaves
  from points (spec/05 §4). Verified monotonic across 0..12000. The cap doubles
  as the bonsai's `InstancedMesh` count, which is what makes the curve
  asymptotic rather than unbounded. Thresholds stay **PROPOSED**.
- **`scripts/capture-states.ts`** — five states captured into `captures/local/`.
  Playwright defaults to `chrome-headless-shell`, which has no reliable WebGL
  and returns black frames; the script forces `channel: 'chromium'` with ANGLE
  on SwiftShader so it also works on a CI box with no GPU.

The capture script fails on any 4xx/5xx or page error, with the URL attached —
a bare "failed to load resource" is unactionable. One allowed exception, and it
is temporary: the Departure Mono 404. **Delete that entry when the font lands.**

**A gotcha worth not rediscovering:** `pnpm build` and `next dev` share the
`.next` directory, so building while the dev server is live leaves it serving
500s (`Cannot find module './600.js'`). It cost a wrong diagnosis — the capture
script's canvas-size timeout looked like an R3F measurement bug and was a broken
server. Stop the dev server before building, or clear the build directory.

**Not run in CI yet.** `capture:states` needs a server on :3000. Wiring it needs
a CI step that builds, starts, waits, captures and uploads — worth doing, not
done.

---

### 2026-09-18 — Phase 1 track A: the empty room, and the gate it does not pass

**Built** (A1.1–A1.6): `scene/objects/RoomShell.tsx` (floor, back wall, right
wall as four segments around the opening), `AndoWallDetails.tsx` (8 joints, 72
back-wall tie-rod holes + 12 on the right wall), `DeskSurface.tsx` (top, four
legs, walnut drawers, brass handles), `scene/lighting.ts`, `scene/RoomScene.tsx`
(five roles / six instances), `scene/cameraPoses.ts`, `scene/CameraRig.tsx`,
`lib/motion/reducedMotion.ts`, `lib/perf/useAdaptiveFps.ts`. The canvas mounts
through `next/dynamic` with `ssr: false`.

`lighting-plan.svg` is ported to the repository root with its colour key updated
to the post-D-21 palette (80 substitutions). Positions and intensities are
untouched — only the swatches moved.

**Measured** on the rendered frame at 1024×768, rest pose, no objects in the
room. Relative luminance, sRGB-linearised, 16×16 patch grid:

| criterion | measurement | verdict |
|---|---|---|
| 1. lamp pool is the brightest area | peak lum 0.41 at x=220 of 1024, warm (R−B = +105), left of centre | **TRUE** |
| 2. right edge cooler than left | left third warmth +28.7, right third −0.6 | **FALSE in substance** |
| 3. warm rectangle on the floor camera-left | lum 0.0138, warmth +35.3, against 0.0 camera-right | **MARGINAL** |
| 4. keyboard zone at ~20% of the lamp pool | 3.3%, and neutral (R≈G≈B≈31) rather than warm | **FALSE** |
| 5. nothing pure black, nothing ambient-flooded | no ambient flooding; 37% of patches are pure black | **INCONCLUSIVE** |

**Criterion 2 is satisfied only by darkness.** The right third is at 1% of the
left third's luminance — it is not cool, it is absent. The cool zone is supposed
to come from monitor 2's emissive and the window, neither of which exists yet.
The right wall is also outside the frustum at desk depth: at the rest pose the
horizontal half-angle reaches x ≈ ±1.38 and the wall is at x = 2.0.

**Criterion 4 is the real finding.** The keyboard zone measures 3.3% of peak,
not ~20%, and the light reaching it is the cool monitor fill rather than the
lamp's warm falloff. Checked analytically before concluding: lamp at intensity
8, distance 2.8, decay 2, at 1.085 m from the keyboard zone gives ~7% of the
near-lamp peak under Three.js falloff. The portfolio's 20% was measured with a
keyboard mesh present — its top face catches the lamp at a much shallower angle
than the bare desk does. **The number in the acceptance test may only be
reproducible on the furnished room.**

**Criterion 5's 37% black is mostly empty frame, not black objects** — the room
is deliberately an open three-sided box with no left wall, ceiling or front
wall, so most of the frame is void by design. Distinguishing "black object" from
"no object" needs a per-object check, which is what `capture:states` is for.

**The spec tension worth an owner decision.** `12-habit-tracker-adaptation.md`
§7 step 1 says to run the acceptance test on the empty room, before any object.
But criteria 2 and 4 reference the keyboard's lit face and the cool right side,
both of which are objects from step 3. As written the test cannot fully pass at
the point the build order runs it. Either the test is re-scoped for the empty
room, or the gate moves to after the object pass. **Not resolving this in code:**
raising it, per CLAUDE.md.

**Also owed from Phase 0, and missed — since shipped, see the entry above.** `06-build-plan.md` §1 marks five
artefacts ★ and says ship all five in Phase 0. `lint-colors.ts`,
`bundle-check.ts` and `scene/lighting.ts` exist. **`scripts/capture-states.ts`
and `lib/growth.ts` do not.** The Phase 0 task list (0.1–0.8) does not mention
either, which is how they were missed — a third internal inconsistency in the
build plan. `capture:states` is the mechanism that makes lighting reviews
diffable instead of "looks fine on my machine", and it is needed for the gate
above, so it should land before track A resumes.

**Two mid-task corrections, recorded because both nearly became wrong code.**
The scene chunk budget was reporting green while matching nothing: a
`next/dynamic` chunk never appears under `manifest.pages`, so `bundle:check` now
scans emitted chunks on disk. Real numbers: shell 89.5 KB gz, scene 207.7 KB gz
against the 320 KB budget. Separately, the canvas appeared unsized on load and I
attributed it to a zero-height parent; the actual cause was
`document.visibilityState === 'hidden'` in a backgrounded preview pane, which
stops rAF and ResizeObserver. The host CSS Module was kept anyway — it belongs
in a module rather than an inline `style` prop under D-01 — but it fixed nothing.

---

### 2026-09-18 — lint:colors now holds the three mirrors together

`design-spec.jsonc` is the palette contract and nothing read it. `lint:colors`
was regex-based and the build never parses the file, so a stray comma in the
third mirror passed every check silently — the only reason the last edit was
caught is that it was validated by hand.

`lint:colors` now does three things instead of one:

1. hex literals outside the palette (as before)
2. **`design-spec.jsonc` parses** — comments stripped with a state machine
   rather than a regex, because the file contains URLs and a naive `//` strip
   corrupts the thing it is validating
3. **the three mirrors agree** — same token set, same values. This is
   `01-color-palette.md`'s "change one, change all three", which until now was
   a sentence with nothing behind it. It catches a missing token, not just a
   changed one.

All three failure modes are asserted in CI rather than assumed: the
`colour-lint-self-test` job breaks each one on purpose and fails if the lint
passes. Verified locally too — a malformed JSONC reports its line and column, and
a one-character drift in `tokens.css` names which mirror disagrees.

---

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

**Known gap — fixed in the next entry:** nothing validated that
`design-spec.jsonc` was parseable.

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
