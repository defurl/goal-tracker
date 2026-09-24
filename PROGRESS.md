# Progress

> **Resume here.** This file is the session-to-session handoff
> (`spec/07-first-session.md` §2). Read this block, then the newest session entry
> below; the rest is history. Update it at the end of every session.

## Start of next session

**State.** The two tracks are at very different points, and the phase labels
in earlier entries of this file got that wrong — see the 2026-09-24 entry.

| | Track A — the room | Track B — the data |
|---|---|---|
| Phase 0 | done | done (shared) |
| Phase 1 | done — A1.1–A1.6, gate TRUE | **in progress** — B1.1, B1.6 committed; B1.2–B1.4 + the gate written, **not yet run**; B1.5 blocked on the CLI. See the 2026-09-24 track B entry |
| Phase 2 | done — A2.1–A2.6, gate TRUE | B2.1–B2.7 |
| Phase 3 | blocked: it is sequential and starts at 3.1, which needs track B's data. 3.7 and 3.8 need no data, but the order is LOCKED | |

**CI is green, for the first time.** All three jobs pass on a real runner:
`verify`, `scene-capture` (lighting gate TRUE with effects on and off), and
`colour-lint-self-test` (all three failure modes still fail). Until
2026-09-24 every run had failed before any project code executed.

---

### Next phase: Phase 1 track B — the data foundation

> **Started 2026-09-24 — read the track B entry below first.** The brief that
> follows is the original handoff and still holds.

**Use a fresh agent.** This one held track A through Phases 1 and 2, and
`06-build-plan.md` §4 forbids one agent holding both tracks in a phase: "the
data work gets an uninterrupted run at RLS." Track B touches `app/api/`,
`lib/` and `supabase/`; it should not need to open `scene/` at all.

**Project:** `https://nosifadaldhgjeyzhpao.supabase.co`, already in
`.env.example`. Anon and service-role keys go in `.env.local` (gitignored) —
never in the repo, never in a commit.

> **Nothing protects that project yet.** RLS is migration 012 and is not
> written. No real data before B1.3 lands.

**Tasks** (`06-build-plan.md` Phase 1 · Track B, schema in `03-data-model.md`):
B1.1 auth, email + Google OAuth, SSR sessions · B1.2 migrations 001–011 ·
B1.3 migration 012, every RLS policy in one reviewable file · B1.4 migration
013, `award_points()`, `enforce_habit_cap()`, `seed_daily_challenge()` · B1.5
generated `database.types.ts`, committed · B1.6 `lib/data/` as the only writer
to `useAppStore`.

**Gate:** the cross-user isolation test. As user A, read AND write all 12
tables as user B; **all 24 attempts must fail**, as an automated test. This is
the one gate in the plan about other people's data — treat it as the
deliverable.

**Constraints enforced in the schema on purpose** — LOCKED, and each is a
breach if routed around:
- `journal_entries` has **no column able to hold entry text** (FR-3.6). Only
  the AI summary is stored. Never log the body of `/api/agent/reflect`.
- `CHECK (points_awarded >= 0)` — no negative points (D-08).
- Points are written only through `award_points()`; `point_ledger` and
  `glow_points` are select-only to the user (X-6).
- `rate_limits` has **no user policy at all** — a user who can write their own
  rate-limit row has no rate limit.
- Habits are archived via `archived_at`, never deleted; deletion would orphan
  logs and rewrite the history the wall grid shows.

**Three things in the spec the track B agent should know first:**
1. **Which phase owns the isolation test is stated two ways.**
   `03-data-model.md` §7 says "Phase 2 does not pass until this test does";
   `06-build-plan.md` makes it **Phase 1 track B's gate**. The build plan is
   the document LOCKED for sequencing, so it governs: do not defer the test to
   Phase 2.
2. `03-data-model.md` §1 annotates migration 013 as `award_points(),
   seed_daily_challenge()` and omits `enforce_habit_cap()`. Not a conflict — §2
   defines it and assigns it to 013, and the build plan lists all three. An
   incomplete comment. Build all three.
3. **Raise with the owner, do not fix unilaterally:** `enforce_habit_cap()`
   counts and then inserts, so two concurrent inserts can both see 9 and both
   succeed, leaving 11 active habits. Low impact — one extra habit, and it needs
   deliberate concurrency — but it is the schema's own invariant failing. The
   schema is LOCKED, so this is a raise, not a patch.

**Then** Phase 2 track B (B2.1–B2.7: prompts and Zod schemas,
`AgentProvider`, `/api/agent/extract` with SSRF guards, `/api/agent/reflect`
with no body logging, atomic rate limiting, `agent_logs`, the hourly seeder).
**Then Phase 3**, which needs both tracks: sequential, re-running the lighting
test after each mechanic.

---

**Commands**
```
pnpm build && pnpm start   # captures MUST come from a production build
pnpm capture:states        # in another terminal; writes captures/local/
pnpm lighting:test                                          # effects on
pnpm lighting:test local room-rest-desktop-reduced-motion   # effects off
pnpm lint && pnpm lint:colors && pnpm typecheck && pnpm build
pnpm bundle:check          # needs a build; stop any dev server first, they share .next
```

**Carried debt — track A, none blocking track B**
1. The mobile capture is framed tight: the camera pose is not adjusted for
   portrait, so the desk crops. `/text` is the mobile fast path (D-07), but the
   room should still frame on a phone.
2. **The window is outside the rest-pose frustum by about 2 degrees.**
   `04-room-spec.md` §4 says the opening "peeks past the monitors' right edge";
   at `REST_POSE` with FOV 50 it does not. Owner decision, worth settling before
   Phase 3.7 gives the window a state table.
3. The window frame shows two bright bars along the top and bottom of the
   opening — frame geometry catching light, not the pane. Invisible at rest.
4. **The notebook reads as a silhouette when focused.** Its `BG_PANEL` cover is
   inside the matte band `06-materials.md` §1 allows, so this is a design call.
   Owner decision before Phase 3.4 puts the journal there.
5. The headphones and the window are not wrapped. Each gets its wrapper with its
   mechanic (3.8 and 3.7).
6. The focus poses are checked at 16:10. The panel is a fixed 480 px, so it
   takes a larger share of a narrow window — re-check around 1024 px wide.
7. GitHub forces `actions/checkout@v4` and `pnpm/action-setup@v4` onto Node 24
   and warns they target Node 20. Harmless today; bump them when Node-24-native
   releases exist.

**Do not** let one agent hold both tracks in a phase (`06-build-plan.md` §4).

---

## 2026-09-24 — Phase 1 track B: schema, gate and auth written; gate not yet run

**Resume here for track B.** Everything below is on disk. What is committed
passed lint, colour lint, typecheck, build and both bundle budgets; what is not
committed has never executed, because no local stack could be started.

| task | state | where |
|---|---|---|
| B1.1 auth, SSR sessions | committed (5 commits) | `lib/supabase/`, `middleware.ts`, `app/auth/`, `app/(auth)/` |
| B1.2 migrations 001–011 | **written, uncommitted, unrun** | `supabase/migrations/` |
| B1.3 migration 012, RLS | **written, uncommitted, unrun** | `supabase/migrations/012_rls_policies.sql` |
| B1.4 migration 013 | **written, uncommitted, unrun** | `supabase/migrations/013_functions.sql` |
| B1.5 generated types | **blocked** — needs the CLI | `lib/supabase/database.types.ts` |
| B1.6 `lib/data/` skeleton | committed | `lib/data/` — hydrates clock + points |
| gate | **written, unrun** | `supabase/tests/isolation.test.ts`, `pnpm test:db`, CI job `database` |

**Why unrun.** The Docker daemon was not running and the Supabase CLI is not
installed. `pnpm add -D supabase` was refused by the agent's permission
classifier twice — once before and once after the owner approved it — so it
was not worked around. **To unblock, run it yourself:**

```
pnpm add -D supabase        # pnpm may ask to approve its postinstall; allow it
# start Docker Desktop
pnpm exec supabase start
pnpm test:db                # the gate: 24 isolation tests + controls + 013 tests
```

Then commit the migrations one per file, the tests, `scripts/test-db.ts`, the
`test:db` script, the `tsconfig.json` change (`allowImportingTsExtensions`, so
Node's native type-stripping can import `./harness.ts`) and the CI job — only
once `pnpm test:db` is green. Then B1.5: add
`"db:types": "supabase gen types typescript --local > lib/supabase/database.types.ts"`,
run it, commit the output, and type the clients with `Database`. CI uses
`supabase/setup-cli@v1` at `latest`; pin it to the devDep's version once that
lands.

**The migrations are not on the hosted project.** Owner decision this session:
review 012 before anything is pushed. Pushing needs `supabase link` with the
database password, which the owner runs.

**How the gate is built.** User B gets one seeded row in every table. A then
tries, per table, one read and one write — and "write" means insert in B's
name, update B's row AND delete B's row; all three must fail. Inserts must fail
with Postgres `42501`, not merely fail, so a check constraint cannot pass for
isolation. Every refusal is confirmed from the service-role side by reading
B's row back unchanged. A control asserts A can read its own profile, so a
broken session cannot make every read "pass" by returning nothing. The harness
refuses any URL that is not `127.0.0.1`/`localhost`: the tests create and
delete users.

**Beyond the spec text — each flagged, none routed around:**

1. **`award_points()` has EXECUTE revoked from `anon` and `authenticated`.**
   Postgres grants EXECUTE on new functions to PUBLIC and Supabase adds anon
   and authenticated, so as written in `03-data-model.md` §4 any signed-in user
   could `rpc('award_points', …)` with any user id and any amount. X-6 holds
   only with the revoke. Same for the seeder. Tested in the X-6 block. Worth an
   amendment note in §4 so the next reader does not "simplify" it away.
2. **`handle_new_user()` is new — PROPOSED.** A trigger on `auth.users` that
   creates the `profiles` row. The spec never says who creates it, and the
   seeder reads FROM profiles, so without it nobody would ever be seeded.
3. **Every security-definer function pins `search_path`.** Standard hardening;
   not in the spec's SQL.

**Raise with the owner — schema is LOCKED, so these are raises, not patches.**
Each is a `todo` test, visible in every run:

1. **Rows can point at another user's parent rows.** Policies check `user_id`
   only, so A can insert a `habit_log` on B's habit, a milestone on B's goal, a
   challenge on B's action — in A's own name. B sees nothing and nothing of B's
   changes, so the 24 attempts still fail, but a server route that trusts the
   parent id (award points for `habit_id`) would act on it. Fix: a
   `with check` that also verifies the parent's owner, on three policies.
2. **A null `ref_id` defeats award idempotency.** `unique (user_id, event,
   ref_id, date)` treats NULLs as distinct, so `perfect_day` — which has no
   natural ref — could be awarded twice a day. Either give it a ref or declare
   the constraint `nulls not distinct` (Postgres 15+).
3. **The habit cap has two holes:** the concurrent-insert race already recorded
   below, and un-archiving — the trigger is `before insert`, so setting
   `archived_at = null` on an eleventh habit bypasses it.
4. **`GoalCategory` disagrees across the seam.** `lib/stores/app.ts` has
   `health | career | learning | personal`; the `goal_category` enum has
   `health | career | learning | relationships | finance | other`. spec/05 is a
   shared file, so this needs both tracks to agree before F4 loads goals.

**OPEN — asked, not guessed:** does a signed-out visitor to `/` see the empty
room or get sent to `/login`? spec/05 §7 argues for the room; nothing decides
it. Middleware refreshes sessions and gates nothing until the owner says.

**Owner setup for Google sign-in:** a Google OAuth client, the provider enabled
in the hosted project's dashboard, and `<site>/auth/callback` in its redirect
URLs. Email sign-in needs nothing further.

**Proposed, blocked by tooling:** a `no-restricted-syntax` rule failing any
`useAppStore.setState` outside `lib/data/`, which would make spec/05 §6
mechanical. The agent's config-protection hook refuses edits to
`eslint.config.mjs`, even tightening ones; the owner can add it.

---

## 2026-09-24 — pushed, CI green for the first time, and a relabelling

Pushed 44 commits — all `defurl`, no attribution, work address absent, checked
before the push rather than after.

**CI had never passed.** Both runs in the project's history failed at
`pnpm/action-setup@v4`, before any project code ran: the workflow set
`version: 11` while `package.json` pins `packageManager: pnpm@11.1.2`, and the
action refuses to run with both. So every "the gate runs in CI" statement in
this file — including Phase 0's claim that the colour-lint self-test is
asserted in CI — was true of the config and never true of a runner. Nobody had
looked at a run. Fixed by letting `package.json` be the single source; the next
run passed all three jobs, and each gate step was confirmed individually rather
than read off the overall conclusion.

**The phase labels were wrong.** A2.x are Phase **2** track A tasks, not
Phase 1. Track A has finished two phases while track B has not started its
first, which is what "next phase" actually means now: Phase 1 track B, under a
fresh agent.

Also this session:
- `06-build-plan.md` gained a dated amendment: every lighting gate is measured
  against a production build. Given the dev-server trap found on 2026-09-20,
  the plan's "effects on and off" had been testing "off" twice.
- `.env.example` cited `spec/02-data-model.md`; the file is `03-data-model.md`.
- `6ce160b` carries a second change its message does not mention: the capture
  upload moved from `error` to `warn` on an empty directory. It was pushed
  before that was noticed, so it is recorded here rather than by rewriting
  public history.

---

## 2026-09-20 — both scene gates in CI, and a mislabelled record

`capture:states` and `lighting:test` now run in CI: build, serve, capture every
state, assert the acceptance test with post-processing on and off, upload the
frames even on failure. The job was run locally end to end first rather than
pushed and watched.

**Wiring it up exposed a bad assumption in the committed record.** Against a
production build the keyboard reads **20.4%** of the lamp pool; against `pnpm
dev` it read 15.4%. The reduced-motion frames — where bloom is off either way —
agreed exactly between the two. That pattern only fits one explanation: the
adaptive-FPS detector trips on a slower dev build and disables bloom, so every
"effects on" capture taken from `pnpm dev` was an effects-OFF frame wearing an
effects-ON label. Both halves of the gate had been measuring the same thing.

Fixed by capturing from `pnpm start`, re-recording `captures/local/`, and
documenting the trap at the top of `capture-states.ts`. CI captures from a
production build for the same reason. The difference is visible, not just
numeric: the drawer strips glow and the room reads warmer.

Worth noting what this says about the earlier sessions' numbers — the five
criteria passed either way, but the effects-on column in the last two entries
was not measuring what it claimed.

---

## 2026-09-19 — the overlay shell, and track A through A2.5

The detail panel landed, and with it the thing the focus poses are composed
around, so the re-framing flagged last session became possible and was done.

- **The composition rule was being violated by the ported poses.** With a real
  480 px panel open, monitor 1 filled the frame centre and the panel covered
  half of it. Every pose is now derived from its object's actual position and
  checked against an open panel. The trick is that the camera looks to the
  RIGHT of its object; targeting the object is what centred them.
- **Monitor 2's float is fixed**, as the A2 gate asks. The portfolio bug was a
  hardcoded offset from a formula that disagreed with the code. The offset is
  now derived inside the component from the instance's own height, so there is
  no number for a caller to get wrong. The group tilt had the same effect from
  another cause — it rotated the foot and lifted its edge — so only the panel
  tilts now.
- **The notebook is legible-ish and no better.** It sits outside both light
  pools; moving it into the monitor fill helped and was not enough. Its cover
  token is within the material band the spec allows, so this is a design call,
  not a defect. Carried as debt 6.

A commit was split after the fact: the object wiring had been staged together
with the pose re-framing under a message that only described the latter.

---

## 2026-09-18 — the interaction grammar, and monitor 1 end to end

`InteractiveObject` ported and one object wired, which is what the build order
asks for before the other six get the same treatment. Verified in the browser
rather than by inspection — all four paths:

| path | result |
|---|---|
| pointer hover | label "daily challenge" appears above the monitor |
| keyboard focus | same label; `aria-label` reads "daily challenge" |
| Enter / click | camera glides to the focus pose, label suppressed |
| back button / Escape | camera returns, hidden focus target comes back |

Two deliberate departures from the extract:

- **Labels are suppressed on an open PANEL, not on any focus.** The extract
  used `focus !== null`; §1 of the grammar says `panelIsOpen`. A glide-only
  object such as the window has no panel and should not blank every other
  label for the duration of its glide.
- **The back control ships now, with the first wired object**, not later with
  the panels. Without it a focus glide is one-way. It lives in the route shell,
  not the scene, so it works the instant the camera moves and cannot pull
  three.js into the shell chunk.

**Found while verifying:** the ported focus poses do not satisfy the
composition rule written directly above them — the focused monitor fills the
frame centre rather than sitting left of it, where a ~480 px right-hand panel
would occlude it. Not fixed here: the right time to re-frame them is against a
real panel. Carried as debt item 6.

---

## 2026-09-18 — the window and the atmosphere layers

Four atmosphere layers in, and the gate re-run with post-processing on and off
(bloom is disabled under reduced motion, so the reduced-motion capture IS the
effects-off case — `lighting:test` now takes a state name so checking it costs
nothing). All five criteria TRUE both ways.

Three findings, in order of how much they cost to find:

- **The glass tint was extinguishing the window.** 04-room-spec.md §6 specifies
  `BG_NIGHT` glass. `MeshPhysicalMaterial` multiplies transmitted light by
  `color`, and BG_NIGHT is about 4% brightness, so the planes behind it
  disappeared and the opening rendered black. Measured on an Intel GPU and on
  SwiftShader to rule out the capture pipeline: 907 lit pixels with the spec's
  tint, 164,956 with a near-white one. Shipped `INK_MUTED` — near-white glares
  at grazing angles, `INK_FAINT` goes too dark to read. The window's darkness
  should come from the dim planes behind it, not from tinting the pane.
- **The scene budget was measuring the wrong thing.** It selected chunks that
  CONTAIN three.js, so every scene dependency that is not three itself sat
  outside the budget meant to cap it. Post-processing landed in a 14 KB chunk
  and went uncounted. The payload is now "everything emitted that no route
  references" — 229.6 KB against the 320 KB budget, not the 209.5 KB previously
  reported. This is the third false green from this script; all three were the
  same shape, a filter that matched fewer files than it claimed.
- **The window never enters the rest frame.** It is placed exactly where the
  room spec says, and the shell is built around that opening, but at REST_POSE
  with FOV 50 it falls about 2 degrees outside the frustum. The spec's stated
  intent — that it "peeks past the monitors' right edge" — is not met. Left
  alone rather than retuning the camera: see the carried-debt list.

---

## 2026-09-18 — the desk objects, and the gate

Phase 0 closed: Departure Mono was vendored, which was its last open item, and
`capture:states` lost the 404 allowance that existed only because the font was
missing. Every request in a capture now has to succeed.

All seven desk objects ported and mounted, one commit each. Three notes worth
keeping:

- **Criterion 4 passes now, at 15.4 %.** It read 3.3 % against the empty room
  and the earlier session concluded the cause was that there was no keyboard
  mesh for the lamp's falloff to land on. Adding the keyboard confirmed it.
  Nothing about the rig was tuned to make this number move.
- **Criterion 1 failed on a measurement bug, not on the scene.** The brightest
  pixel in frame is a specular highlight on a brass drawer handle — a line, not
  an area. `lighting:test` now compares region MEANS, and names the two screens
  explicitly, because they are the only things that could plausibly out-shine
  the lamp pool. Pool 0.254 against monitors 0.087 / 0.058.
- **The two drawer handles read orange on the left and green on the right.**
  Same brass, same material; one is lit by the lamp and one by the monitor
  fill. That is the colour-temperature zoning in §3 of the lighting rig doc
  working, not a stray colour.

`pnpm lighting:test` is new. The five criteria were written to be eyeballed,
which makes "the right edge reads cooler" a matter of opinion and a regression
easy to miss; it now measures them off the committed capture and exits
non-zero.

---

## Why this file and not GitHub issues

Chosen over one issue per build-plan task: it works offline, it is reviewed in
the same diff as the code it describes, and it costs one edit per session. If
the project outgrows a single file, move to issues — but move, do not run both.
`git log` is the changelog; this is the state.

---

## Where the project is

**Phase 1 track A — the empty room is built; the lighting gate is not signed
off yet.** Shell, Ando detailing, desk, the five-light rig, the camera rig and the
two perf/motion hooks are in. Two of the five acceptance criteria measurably
pass, one is marginal and two cannot be evaluated yet — see the entry below.
**Per the build plan, no object enters the room until all five read TRUE**, so
track A is paused pending an owner call on the two that reference objects which
do not exist at this point in the order.

Track B (data foundation) is untouched: it needs a Supabase project, and
`06-build-plan.md` §4 forbids one agent holding both tracks.

**Phase 0 is complete**, verified task by task against `06-build-plan.md`:
0.1–0.8 all done, the gate passes both halves, and all five star artefacts
exist. 0.4 closed last, on 2026-09-18, when Departure Mono was vendored into
`public/fonts/` — the `@fontsource` faces were already wired, so the only thing
outstanding had been the self-hosted mono face.

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
a bare "failed to load resource" is unactionable. There are no exceptions: the
one that existed, for the Departure Mono 404, went away with the font.

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
| 0.4 fonts | `app/layout.tsx` (Fraunces, Geist), `public/fonts/` (Departure Mono, vendored) |
| 0.5 `globals.css` | `styles/globals.css` |
| 0.6 empty zustand stores | `lib/stores/{app,interaction,scene}.ts` |
| 0.7 ESLint 9 flat config, Husky, commitlint | `eslint.config.mjs`, `.husky/`, `commitlint.config.mjs` |
| 0.8 `bundle:check`, both D-10 budgets | `scripts/bundle-check.ts` |

**Outstanding — carry into the next session**

1. **`lint:contract`** — `spec/07-first-session.md` §3 recommends extending the
   colour lint to cover D-01 (no Tailwind/shadcn), D-02 (no Inter), D-03 (no
   light mode) and D-05 (no hardcoded ms). Roughly sixty lines, and it converts
   four documented rules into build failures. Open as a follow-up, as §3 asks.
2. **`.claude/commands/lighting-test` and `/dod`** — `spec/07-first-session.md`
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
