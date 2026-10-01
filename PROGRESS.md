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
| Phase 1 | done — A1.1–A1.6, gate TRUE | **done — B1.1–B1.6, gate TRUE locally** (24/24, every raised gap closed by owner decision; CI `database` job green on a runner, run 35996635651, every step checked; migrations 001–016 pushed to the hosted project 2026-09-25 — anon reads empty, anon insert and `award_points` refused with 42501; Google sign-in not set up, button hidden behind `NEXT_PUBLIC_AUTH_GOOGLE`). See the 2026-09-24 track B entry |
| Phase 2 | done — A2.1–A2.6, gate TRUE | **done locally — B2.1–B2.9, gate TRUE** (AC-3.2 dump test, both agents usable with the provider network-blocked, `/text` free of three.js). Migrations 017–021 **not yet on the hosted project**. See the 2026-09-25 entry |
| Phase 3 | **done — 3.1–3.8, gate TRUE** (every spec/05 §3 row wired and lerping; the wall reads as texture at rest). Several values are PROPOSED — see the 2026-09-28 entries | (shared — Phase 3 is one sequence) |
| Phase 4 | **done — 4.1–4.6, pushed, CI green on a runner** (run 36564302228, all five jobs); 4.7 closed by D-22. See the 2026-09-29 entry | (shared) |
| Phase 5 | **done — A5.1–A5.9, gate TRUE** (the window, the timer, the steam, the daylit window, the bonsai rewired and moved, the hall behind the door with its history, and that history on /text; every sky band pinned in CI) (D-24) | **done** — B5.1 (plans) and B5.2 (account deletion) (D-24); 025 on the hosted project 2026-10-01 |
| Phase 6 | **in progress** — 6.1 done: the review board is published; 6.2 waits on the owner's marks (D-25) | (shared) |

**CI is green with five jobs** (run 36737013095, A5.8): `verify`, `database`,
`colour-lint-self-test`, `scene-capture` (lighting gate with effects on and
off, then `a11y:check`, `motion:check`, `offline:check`) and `lighthouse`
(`lh:check mobile`: /text and auth, no warnings). Every action is on a Node 24
release. The room's Lighthouse run is local only: on the first CI run it never
finished on SwiftShader (`Network.getResponseBody` timed out). A failed
Lighthouse assertion shows as an annotation, readable without admin rights.

`WORKLOG.md` is the feature-by-feature record of what the product does and
looks like; this file stays the state.

### Next session

**Phase 6, the UI rework, is under way** (2026-10-01, D-25). 6.1 is done:
the review board is published, private to the owner, at
https://claude.ai/artifact/Hr1ZgKWVMvQhMeoqjdmJ7b (30 items, 58 captures).
The owner marks each item keep, change or I'll design it. **6.2 starts when
the marks are in:** read them with `ArtifactData` `list` on the collection
`verdicts` (one document per item id: `verdict`, `note`, `updatedAt`), then
group them into tasks, smallest first. Re-capture with `pnpm review:capture`
(a production build on the local stack; writes `captures/review/`, not
committed) and republish the board to the same artifact URL.
- **6.1, the board.** Captured from a production build against the local
  stack, signed in as a throwaway user with a seeded year (deleted after),
  and pinned to 22:00 so the room wears its night look. Panels were opened
  from the keyboard, so each title shows its focus ring. The scene's open
  PROPOSED values are a group of their own. Store checked: one probe
  verdict written, read back and deleted. **Seen while capturing, left for
  the owner's marks rather than fixed:** on a phone the sound control sits
  over an open panel and "back to the desk" shows through the panel's bottom
  edge; the armed delete label runs into the sound control (B5.2's note, now
  visible).
- **Deployed** (2026-10-01) at https://be-better-everyday-one.vercel.app
  (Vercel, auto-deploys from `main`; `be-better-everyday.vercel.app` belongs
  to someone else). The first build ran without the Supabase variables: the
  client bundle carries the Supabase library but no project URL, and the
  corner's sign-in, drawn only when Supabase is configured, is missing — so
  nobody can sign in yet. **The owner's:** add the variables for Production
  and redeploy; set Supabase's Site URL to the domain and add
  `<domain>/auth/callback` to its Redirect URLs. Then confirm sign-in
  appears, and run the signed-out checks against the live URL.

**Phase 5 is done** (2026-09-30): Track A (A5.1–A5.9) and Track B (B5.1,
B5.2), gate TRUE. Reminders stay unsent.
- **The Phase 5 gate.** Lighting TRUE in all five sky bands: dusk (18:00) and
  the evening (21:00) are now pinned captures, lighting-tested in CI beside
  dawn, noon and midnight. In every room state the pool peak is at most 0.687,
  and all four hall states are TRUE, effects on and off. Scene 240.8 / 320 KB
  with the shell three-free; a11y, motion and offline pass, and cover the hall
  and /text's history. The new spec/05 §3 rows (steam, rim, history, the hall
  tree) are wired.
- **A5.9, history on /text** (2026-09-30). A History section, last on the
  page, holds the hall panel's list (`HistoryList`, now given a `surface`).
  Under each habit, its last twelve weeks as a strip: 84 days, a week to a
  column, today last, kept days in `--signal`. There is no strip when nothing
  was kept in those weeks — an archived habit months gone would be 84 empty
  cells. The read waits until the section is within 200 px of the screen.
  Walked signed in as a throwaway local user with a seeded year, at 390 and
  1280 px:
  - no history read before scrolling, one after;
  - strip counts match the seed (walk 64, gym 33), and the Mon/Wed/Fri habit
    reads as rows;
  - axe is clean on the whole page signed in, which `a11y:check` (signed
    out) cannot see;
  - no horizontal overflow, and the page's end clears the corner.

  `offline:check` now expects the Focus and History sections too. Lighthouse
  /text is 0.99 median both before and after, CLS 0, TBT within this
  machine's noise.
  **PROPOSED, for the owner's eye:** the welcome copy ("Your kept days will
  gather here."), the 0.7 rem cell, and the full `--signal` fill, which is
  louder than the hall's wall.
- **A5.8, the hall** (2026-09-30), design-system/13 with an "as built"
  section (§10) recording every value the build moved and why. The room's
  floor spill is a door ("step through"): glide, fade, the canvas swaps to
  the hall, compiled before it fades in; back is two steps (the hall's
  arrival, then the room). `?scene=hall` opens it directly, for links and
  for the checks. The hall is its own chunk (scene 240.8 / 320 KB, shell
  three-free), fetched on the door's first hover; offline it opens only if
  already fetched. Five roles, six instances; its own five-criterion test
  in `lighting:test` (a `hall-…` capture), TRUE at noon and midnight, effects
  on and off, and in CI. Walked signed in as a throwaway local user with a
  seeded year: the panel's numbers (longest 43 · now 2 · kept 279; an
  archived habit labelled, no "now"), the lines legible at the wall pose.
  **Known limits:** CI has no history, so criterion 4's "legible up close"
  is a local measurement; the fade is a cut under reduced motion, not a
  crossfade; the wall shows at most 24 lines. **For the owner's eye:** the
  pendant's shade throws a hard curved cut-off across the lower wall (it is
  what keeps the band in shadow so its light reads), and the wall is very
  dark at the wall pose.
- The per-habit history (`lib/history.ts`, `lib/data/history.ts`) computes
  the current streak from the days by log_habit()'s rule; the stored one is
  stale after a missed day. The data layer cannot be imported by the
  database tests (extensionless imports under plain Node), so its queries
  were checked by the walk, not by `test:db`.

**A5.7's design note is approved** (2026-09-30):
`design-system/13-door-scene.md` and `13-hall-lighting-plan.svg`. The owner
chose the hall, a year line per habit with the longest run marked, archived
habits on the wall after the active ones, and a glide-only tree. Its numbers
stay PROPOSED until A5.8 tunes them against its §5 test. Next: A5.8, the
build.
The note also fixes two gaps the research found: the store has no per-habit
history (only the combined day grid, which includes archived habits' days
while `habits` excludes them), and the stored `streak` is stale after a missed
day until the next check-off (`log_habit()` is the only place it is computed).
- **A5.6:** the bonsai is at `[-0.6, 0, 0.2]` and the mug at
  `[-0.46, 0, -0.06]` (owner's pick, D-11 amended). At rest: pool 0.250
  (0.248 before the tree existed), keyboard 20.4 % (as then), pool peak 0.682
  (was 0.940). TRUE in all seven lit states. Measured with a scratch-only
  build that took positions from the URL, headless Chromium on the RTX 2060
  for effects on (SwiftShader drops bloom mid-run under load, so its numbers
  are not comparable frame to frame) and reduced motion for effects off.
  Learned on the way: the mug's pale liner is the pool's hottest pixel
  wherever it goes near the bulb (1.0 at the tree's old spot), and in
  monitor 1's cool fill it glows cyan; behind the headphones it is neither.
  The pot now clears the headphones' left earcup by 1.3 cm (footprints
  computed; closer candidates overlapped it). Bonsai focus pose moved with
  the tree; new capture `room-bonsai-desktop`. design-system/04's mug
  `[-0.55, 0, 0.15]` and 12's `[-0.8, 0, 0.1]` are extracted fact; D-11's
  amendment overrides them.
- **A5.5:** `leafArrival` in the store ('grow' from an action's refresh or the
  optimistic habit write; 'appear' from every hydrate path, snapshot
  included). Earned leaves come one at a time, a droplet each, 600 ms apart
  (`lib/leafSchedule.ts`, PROPOSED stagger); a run in progress keeps its place.
  The droplet now falls at (-0.03, 0.042) in the tree's frame, in front of the
  canopy. Walked on a local build as a throwaway user, frozen with
  Playwright's clock: the droplet in mid-fall in front of the top pad, the
  first leaf growing as it lands, and a second droplet 600 ms later — the
  server's Perfect Day +25 took 20 → 45, a second leaf, so the sequencing ran
  for real. An admin award then an `online` rehydrate brought a leaf with no
  droplet. Unit tests for the schedule and for `lib/growth.ts` (none existed).
  Stale docs fixed: spec/02 × 0.35, spec/README "a leaf per completion",
  spec/05 "a bare bonsai", and the camera-pose comment. design-system/12
  still says × 0.35; it is extracted fact, and D-23 §2 overrides it.
- **A5.4:** the window is daylit (12 §6 option 2). **PROPOSED, for the owner's
  eye:** day sky `GLOW_COOL_SOFT` × 4.0 (was 1.4; at 2.0 it read as a dim
  evening blue through the pane), and the rim at 1.2 after dark, 1.8 at dawn,
  2.5 by day (`RIM_STATES`), lerped in `scene/WindowRim.tsx`. The day sky is
  L ≈ 0.52, over the bloom threshold on purpose (1.4 already was, ≈ 0.18); only
  the warm dusk band must stay under. At 16:10 rest only the city strip is in
  frame, so the day sky is seen from the window's glide (`room-window-noon-
  desktop`). Lighting TRUE at noon and midnight, effects on and off; noon's
  right edge reads cooler (R−B −2.5 vs −1.5). CI now tests all four. The rim's
  effect on the room is small — the room stays nocturnal, as D-24 §9 asks.
  Captures under load vary bloom (the city strip reads (17,34,44) one run and
  (4,16,24) the next): adaptive FPS, as noted in Phase 4.
- **A5.3:** six unlit INK_PAPER sprites (≤ 0.08 opacity, no depth write) rise
  off the mug in the dawn band only, lerped in at k = 0.05; `MugSteam` returns
  null under reduced motion. A new spec/05 §3 row. The steam starts visible at
  opacity 0 so ShaderWarmup compiles its program (compile skips invisible
  objects). New `room-dawn-desktop` capture, pinned to 06:00 with a Playwright
  time zone (`scripts/zone-for-hour.ts`); CI lighting-tests it, and
  `motion:check` checks the room still at dawn. Lighting TRUE at rest (on and
  off) and at dawn; the steam moves the numbers only in the third decimal.
  Stillness cannot tell removed from frozen: removal rests on the code.
- **B5.2:** "delete account" beside sign-out (room and /text) arms, then fires
  within 3 s, and calls `DELETE /api/account` (session id only; DELETE so no
  cross-site form can send it). `account.test.ts` seeds every user table,
  deletes, and finds no row left; agent_logs rows stay with a null user.
  Walked on a local build signed in as a throwaway local user: arm, lapse,
  delete, landed on /login with no session cookie and no snapshot, and the
  admin API found no user and no rows. A signed-out DELETE is a 401. /privacy
  now says how; D-22 has an amendment note. Not covered by `a11y:check`,
  which runs signed out. On a phone the armed label wraps the corner pair to
  two lines, which may meet the room's sound control above it.
- **A5.2:** focus on starts two minutes (`lib/focusTimer.ts`, the timeout in
  `lib/data/focus.ts`); at the end the bed fades and focus turns off, nothing
  else. The store holds only `focusEndsAt` (spec/05 §2); the countdown ticks in
  the DOM that shows it: beside the sound control in the room, and a silent
  Focus section on /text. Leaving either surface ends its timer, and the room's
  bed follows the live store, so a /text timer never becomes sound. Walked: the
  /text timer ran out by itself at two minutes; the room showed 1:58 beside
  "sound on" and cleared when sound went off.
- **B5.1:** `user_plans` (025), read-only to its owner and made by
  `handle_new_user()`; the rate limiter reads the cap from the plan, and a
  missing or unreadable plan reads as `free`. Database 80/80 (13 tables in the
  isolation gate). 025 is on the hosted project (2026-10-01).
- **A5.1:** the window glides and opens nothing; the object in focus drops its
  label and keyboard button, as a panel object does when its panel opens.
  Escape and "back to the desk" return. Lighting TRUE, effects on and off;
  a11y, motion and offline checks pass. New capture `room-window-desktop`. The
  pose is 07-camera's `[0.4, 0.9, 0.9]`, so the window is seen at an angle,
  small, right of centre: worth the owner's eye in the UI rework.
- Verified against a production build in a scratch worktree on port 3100,
  because `pnpm build` would overwrite the `.next` of the owner's dev server
  on 3000.

The plan: The owner set its scope in
`spec/01-decisions.md` D-24; `spec/06-build-plan.md` Phase 5 lays it out.
Track B (B5.1 plans, B5.2 account deletion) runs beside Track A, which starts
at A5.1 (the window, glide only) and ends with the door scene. A5.7 is a design
note for the owner before any door-scene code. Reminders stay unsent, and the
UI rework is its own later phase, reviewed and partly designed by the owner.
Deployment is the owner's, later.

Found while planning, for the task that touches them:
- A5.5: spec/02 and design-system/12 still say leaf tone × 0.35 (D-23 §2 locked
  0.25); spec/README says a leaf per completion (spec/05 and AC-2.4 say per
  threshold); spec/05 says a bare tree at `leafCount` 0 (D-23 §3 locked eight
  base leaves). `cameraPoses.ts` still says the bonsai "does not exist yet".
- A5.3: the mug is mounted at `[-0.62, 0, 0.06]`, not 04-room-spec's
  `[-0.55, 0, 0.15]`, inside the lamp pool beside the bonsai; A5.6 may move both.

Earlier, still true:
1. **Migrations 001–025 are on the hosted project** (022–024 pushed
   2026-09-30 and 025 on 2026-10-01, each at the owner's request; `db push
   --dry-run` reports it up to date). After 025, an anon read of `user_plans`
   returns `[]` and an anon insert is refused (42501). The app can be deployed.
2. **`GENTLE_SUPPORT_REFLECTION` is signed off** (owner, 2026-09-30): the
   reflection shown when the journal agent flagged distress but its words
   quoted the entry (`lib/prompts/fallbacks.ts`).
3. **Backlog the owner named** (D-22, D-23): in-app account deletion, per-user AI
   limits for free users, the bonsai rework (droplet, growth, its place in the
   pool), the headphones' two-minute timer, the window as a glide-only object.
   The UI will be reworked once the build phases are over.

**Phase 4 questions: all settled, 2026-09-30 — `spec/01-decisions.md` D-22.**
Offline stays /text plus an open room; CI Lighthouse covers /text and auth,
with LCP ≤ 2.5 s now an error; informative text needs 4.5:1; auth text is at
least 12 px on phones; destructive actions arm, then fire; data requests go to
the owner's address, now on /privacy; COST-1 is met by the free tier with no
billing attached, so 4.7 is closed. Build-plan rows 4.5 and 4.7 point at D-22.

**Phase 3 decisions: all settled, 2026-09-30 — `spec/01-decisions.md` D-23.**
Ten values locked as built (bonsai spot until its rework, leaf tone 0.25 at
scale 0.88, 8 base leaves, droplet only for a new leaf, wall 53 × 7 at 0.1,
phone face up at 0.35 / 1.1, 3 s import close, dark ink and the SIGNAL
bookmark, audio ≤ 100 KB, no sound on /text). Seven built the same day, one
commit each:
- the window moves to z = -0.6 and now peeks at the right edge; the lighting
  test reads TRUE in all five sky bands, effects on and off
- dusk's sky is 0.16 (L ≈ 0.089), under the bloom threshold
- 022: habit_logs and daily_challenges are SELECT-only to their owner
- 023: one goal award per user per day, inside award_points()
- 024: `prompt_version` on user_actions and journal_entries
- JOURNAL_ANALYSIS_V3 and a server check: a reflection sharing five words in a
  row with the entry is neither stored nor shown
- the support resources were checked against each service's site and signed
  off; `VERIFIED_ON` is 2026-09-30, re-check by 2027-09-30

Local gates on the final tree: unit 131/131, database 75/75 on a fresh stack
with 001–024, lighting TRUE. Worth knowing: `supabase db reset` fails from
Git Bash on this machine (a temp-directory error) and works from PowerShell.

**Owner's signed-in walk, 2026-09-30.** Done by the owner; the agent does not
sign in to the hosted project.
- sign-in lands in the room, not /text. That is by design on a desktop (phones
  are sent to /text by the middleware), so /text right after sign-in was not
  walked
- the goals panel (timeline, milestones) is approved as it stands; the UI will
  be reworked once the build phases are over
- archive's two presses work
- **the bonsai's droplet and its growth animation are not well wired** — noted
  for a later phase, not fixed
- the privacy link: reported as "no page". Not yet clear whether /privacy
  404ed or the contact and deletion lines are missing — ask
- every panel shows loading or real content, never a wrong empty state
- sign-out clears `bbe:snapshot:v1` from local storage
- 4.7 closed: the free tier with no billing cannot be charged (D-22 §7)

---

## 2026-09-29 — Phase 4, hardening

Commits `700f1b4`..`1118729` plus this one, not pushed. Every gate passes on a
fresh production build on this machine: lint, colours, types, unit tests,
build, bundle budgets, `lh:check`, capture + lighting test (effects on and
off), `a11y:check`, `motion:check`, `offline:check`.

**4.1 Lighthouse.** Baseline: the room scored 0.66 on desktop (TBT 970 ms) and
0.52 as a phone. A CPU profile put all of it in `WebGLProgram.getUniforms`:
the first frame linked every shader synchronously, a 1.4–1.6 s long task on an
RTX 2060. `scene/ShaderWarmup.tsx` compiles each program in its own task
before the frame loop starts (`frameloop="never"` until then). The first
attempt made it worse: the composer draws into a render target, and three
builds different programs for one, so the warm-up now compiles against a
render target whenever bloom is on. After: the long task is 130 ms, and the
room scores 0.96 median. `data-room-ready` marks the first frame; capture, axe
and the motion check wait for it.

`pnpm lh:check` runs Lighthouse CI (`lighthouse/mobile.json` for /text and
auth as a phone, `lighthouse/desktop.json` for the room). Medians of three on
the final build:

| route | perf | LCP | TBT | CLS |
|---|---|---|---|---|
| `/` desktop | 0.96 | 479 ms | 152 ms | 0 |
| `/text` phone | 0.99 | 1960 ms | 55 ms | 0 |
| `/login` phone | 0.99 | 1808 ms | 14 ms | 0 |
| `/signup` phone | 0.99 | 1807 ms | 30 ms | 0 |

Errors: performance ≥ 0.85 on the DOM routes, CLS ≤ 0.1, no console errors,
script transfer ≤ 200 KB (shell) and ≤ 520 KB (room). Warnings: the room's
score, because a runner draws it on SwiftShader (0.76 there), and mobile LCP.
The script owns the Chrome that Lighthouse connects to: on Windows
chrome-launcher deletes its profile before Chrome has exited and every run
fails with EPERM, and a browser launched through Playwright times Lighthouse
out.

The 404 was `/favicon.ico` (no icon link). The icons are now in `metadata`,
plus a 180 px PNG apple-touch-icon rendered from `icon-maskable.svg`.

**4.2 axe.** `pnpm a11y:check`: WCAG 2.1 AA over /text, auth and /privacy at
two sizes, and over the room at rest and with each of the six panels opened
from the keyboard. One real failure, fixed: `.faint` and the journal counter on
/text were `--ink-faint`, 3.3:1 on the void.

**4.3 Reduced motion.** Every row of the 03-motion table already had a code
path. `pnpm motion:check` proves it: under reduced motion two frames a second
apart must be pixel-identical, at rest and straight after opening a panel;
grain, transitions and the panel animation are read from the DOM; and a
control run with motion allowed must differ.

**4.4 Empty states.** A read-only audit of every panel, section and widget.
Nothing crashed on empty data and nothing was punitive. What was wrong:
- /text and the panels rendered before the first load and before auth was
  known, so users saw "No habits yet" or "sign in" for a moment. They now wait
  on `useSurfaceState`. Panels show the skeleton; /text renders its default
  state invisibly (`Pending`), which keeps the layout. A skeleton there cost
  CLS 0.19 and dropped /text to 0.86.
- a new visitor saw a row of zeros. The counters now appear with the first
  point, and "leaves on the bonsai" is "leaves grown" (it counts earned ones)
- goal details had no loading state and no catch, so a failed read meant "No
  goals yet" for good. The store's summaries now stand in
- no line when nothing is due today
- a rejected `getUser()` left `hydrated` false forever; it now settles
- the journal kept the last user's insight after a session ended in another tab
- found on the way: the sign-out form navigated away before `SIGNED_OUT`, so the
  offline snapshot was never cleared. The form clears it now.

Left as they are: the bonsai's 8 base leaves (owner decision), the wall with no
lit cell when signed out (intended), and a signed-in journal with no entries
showing 35 empty cells and no "no entries yet" line.

**4.5 Offline.** `pnpm offline:check`: /text reloads from the service worker
with the network off and shows every section; a cold offline `/` lands on the
/text shell; a room already open keeps rendering and opens panels when the
network drops. The signed-in snapshot is not covered. See question 1 above.

**4.6 Privacy.** `/privacy`, linked from the journal on both surfaces and from
auth. It leads with FR-3.6 (entries are never stored, so nobody can read one
back) and states that with AI Reflect off the words never leave the device.
The AI paragraph follows the same flag as the button. Every claim is traced to
code in the page's header comment.

**Debt closed:** the favicon 404, the apple-touch-icon, archive confirmation,
refreshed captures, and the Node 20 actions. The captures were taken on an idle
machine. One taken straight after `lh:check` read keyboard 18.8% / peak 0.81
as "effects on", because the adaptive-FPS detector had dropped bloom. Idle, it
reads 24.5% / 0.978, the same as before the warm-up. CI captures have the same
exposure if a runner is ever slow.

## 2026-09-28 — Phase 3.8, and the Phase 3 gate

**3.8 done.** The headphones and a bottom-right "sound off / on" control flip
`focusMode` (`lib/data/focus.ts`, not persisted — every visit starts silent);
`app/(app)/AudioControl.tsx` owns the bed and follows it. The bed
(`lib/audio/ambient.ts`) is synthesised with Tone.js — lo-fi pad, room hum,
brown-noise rain, an occasional gust — and fades 0 → 0.3 over 600 ms. Leaving
the room fades it out and turns focus mode off.

Measured on the production build, with the AudioContext tapped by an analyser:
no AudioContext and no Tone chunk before a click · after "sound on" one
running context, output RMS 0.015, `aria-pressed` true · after "sound off",
RMS 0 once faded · the headphones via Enter turn it back on and the corner
control follows. No console errors.

**Budget.** Tone.js is one lazy chunk, 76.3 KB gz. `bundle:check` counted it as
scene (the room at 312 of 320 KB) though nothing needs it to render the room;
it now reports its own line — `audio ≤ 100 KB`, **PROPOSED**, not one of
D-10's two — and fails if it ever reaches the shell. Scene is back to 236.1.

**Not built, raise with the owner:** spec/00 lists the headphones as "Focus
Mode toggle. Two-minute timer." The build plan's 3.8 and spec/05's table
have the toggle and the audio only, so there is no timer. `/text` has no
sound control — ambient, not one of the four features.

**Phase 3 gate — TRUE.** Every row of spec/05 §3 is wired and lerps (snaps
under reduced motion): monitor 1 emissive and texture (3.1), phone screen
(3.2), monitor 2 texture (3.3), notebook bookmark (3.4), wall grid (3.5),
bonsai (3.6), window sky (3.7), ambient gain (3.8). At rest the wall grid
reads as texture (3.5, filled glow 0.1). The lighting test read TRUE after
each step, effects on and off. The owner decisions still open are listed in
the entries below: the bonsai's place in the lamp pool (D-11), the wall's
layout and glow, the leaf tone and base leaves, the phone lying face up.

---

## 2026-09-28 — Phase 3.7: the window sky by the hour

**Done; the lighting test reads TRUE in all five bands**, effects on and off,
with spec/05 §5's table exactly as written (`lib/sky.ts`, 4 unit tests).

- `scene/objects/Window.tsx`: the sky plane lerps colour and intensity toward
  the band at k = 0.05; the first hydrated frame snaps, so a page load does
  not fade in from night; reduced motion snaps always. The city plane is
  untouched (spec/05 §5).
- `lib/data/clock.ts`: `localHour` was written once at load, so the window
  would have held that hour all session. A one-minute clock in the data layer
  now rewrites it, in the profile zone or the visitor's. `browserTimeZone`
  moved to `lib/data/time.ts` to share it.
- Seen: at a 2.4:1 frame, where the window is in view, night and evening are
  near-black, dawn and day cool (day brighter), dusk warm.

**Worth knowing:** at the 16:10 rest pose the window's sky is just outside the
frame (≈ 38° off-axis against a ≈ 36.5° half-width), which is why every band
measures identically — the table cannot disturb the rig there. On a frame
wider than ≈ 1.7:1 the window comes into view, and dusk's `LAMP_WARM` × 1.0
(L ≈ 0.55) blooms on the right edge, the cool side. Not a failing criterion
(the test captures at 16:10), but criterion 2's spirit — the right edge reads
cooler — would weaken at dusk on an ultrawide screen. Also: night's
`BG_NIGHT` × 0.8 is darker than the fixed tint it replaces (L 0.004 vs
0.046); the city below now carries the window at night.

---

## 2026-09-28 — Phase 3.6: the bonsai

**Done; the lighting test reads TRUE** with the tree bare and fully grown,
effects on (hardware-GL probe) and off (`capture:states`, reduced motion).

- `scene/objects/Bonsai.tsx`, on the desk at `[-0.8, 0, 0.1]` (D-11), top pad
  ≈ 0.29 m. Primitives: matte pot, tapered S-trunk with knuckles, four pads.
  Leaves: one `InstancedMesh` of 8 + `MAX_LEAVES`, flattened so they read as
  pads. Frame loop reads `points.leafCount` and idles once settled.
- **Growth:** a new leaf is announced by a `GLOW_COOL` droplet (180 ms, the
  room's one sharp motion) and grows over 900 ms; seen mid-fall in a burst
  capture. Leaves already earned on load are simply there. Reduced motion:
  no droplet, instant. A reset to the default room (sign-out) snaps — it is
  not a loss of growth. No leaf is ever animated away.
- Opens the habits panel. Focus pose checked against a render (left of the
  panel); portrait subject updated to the real geometry.

```
                     pool    keyboard  pool peak
before the bonsai    0.248   20.4 %    0.437
bare (8 base)        0.197   25.6 %    0.941   first build, before the fixes below
full, 64 leaves      0.218   23.2 %    0.945
full, effects off    0.207   17.8 %    0.802
```

**Raise with the owner:**
1. **It sits in the lamp pool.** D-11 locks this position; doc 12 §3.2 warned
   that the pool is where the tree must not go. The test still passes with
   margin (pool 0.218 vs monitors 0.081), but the pot covers part of the
   pool's probe box — the pool figure fell 12 % for that reason, not because
   the pool dimmed — and the lamp's pole now runs behind the canopy at rest.
   The probe was not moved: that would be tuning the test to the tree.
2. **Pool peak 0.945 against criterion 5's < 1.** The hottest pixels are the
   top leaves, ~12 cm from the bulb, clipping toward chartreuse. Passing, but
   by the thinnest margin in the rig. Moving the tree right, or lowering it,
   is the real fix and needs D-11 amended.
3. **PROPOSED:** leaf tone `DATA_GREEN × 0.25`, not the spec's 0.35 (the
   portfolio plant never sat under a bulb; at 0.35 the leaves clipped to
   lime-white); tree scaled 0.88 to lower the canopy; **eight base leaves
   always present**, because a new user's bare tree read as dead — the
   wilting plant the anti-patterns forbid. Earned leaves are unchanged.
4. **PROPOSED:** the droplet plays when a LEAF is earned, not on every
   completion — spec/05's table maps only `leafCount` to the bonsai.

**Not verified signed in:** a real completion crossing a threshold.

---

## 2026-09-28 — the detail panel floats and fades in (owner decision)

**Owner decision:** clicking an object zooms the camera in, then its content
fades up in a floating panel — replacing the portfolio's edge-to-edge
slide-in. Amended in `design-system/08-interaction-grammar.md` §5 (and its
mirrors in `design-spec.jsonc`, 03 reduced-motion table, 07, 12). The
anti-pattern list is unchanged: the panel is still corner furniture, never
centred, never glass, never over the object.

- `app/(app)/DetailPanel.module.css`: 440 px, inset `--step-4` (16 px under
  480 px wide), height fits its content up to the viewport. 600 ms fade and
  8 px rise after a 1200 ms wait, so it arrives as the 2200 ms glide settles.
  Keyed by panel, so gliding between objects fades the new content in.
- Measured: normal motion, opacity 0 at 150 ms and 1 by 2.15 s; reduced motion,
  1 at 150 ms (the global rule shortens durations, not delays, so the panel
  sets `animation: none`); focus lands on the heading in every case.

**Portrait framing — found, then fixed the same day.** On a phone held
upright the wide focus poses put the object off the left edge (always so; the
old full-height panel hid it). `portraitPose()` in `scene/cameraPoses.ts` now
derives a pose for any frame taller than wide: same viewing angle, backed off
until the object fills 80 % of the width, aimed so it sits about a third
below the middle, clear of the panel. The camera is capped at 3 m, so the wall
band is cropped at the sides in portrait (the panel has its numbers).
`CameraRig` picks it by aspect, not by the phone media query, so an upright
tablet gets it too, and re-aims on rotation. 38 unit tests project every
object through a three.js camera at 375×812 and 768×1024; returning the wide
pose instead fails 23 of them. Checked by eye on all five objects at phone
size and the phone at tablet size: each is centred under the panel.

---

## 2026-09-28 — Phase 3.5: the wall tracker

**Done; the lighting test reads TRUE**, effects on (hardware-GL probe) and off
(`capture:states` reduced-motion frame), with 70 % of a year filled.

- **Scene** — `scene/objects/WallGrid.tsx`: 365 cells on the back-wall panel
  centred at `[-0.75, 0.493]`, between its tie-rod rows. Two instanced layers
  (two draw calls): a lit `INK_GHOST` base, and an additive glow layer the
  frame loop fills from `dayGrid`, lerped per cell at k = 0.05 and idle once
  settled. Only today (`SIGNAL` × 0.9, L 0.43) blooms. Hover lifts the glow
  ×1.2; one invisible plane takes the pointer so the gaps do not flicker.
- **Panel** — `app/(app)/panels/HabitsPanel.tsx`: `/text`'s `HabitsBody` under
  one line of totals — days kept this year, glow points. No count of missed days.
- **Focus pose** — the `wallGrid` pose, checked against a render with the panel
  open: the whole band sits left of it. Two alternatives were tried and were
  worse (see the comment in `scene/cameraPoses.ts`).

**PROPOSED — raise with the owner:**
1. **Layout: 53 columns × 7 rows at a 2.5 cm pitch (2.2 cm cells)**, not ~4 cm
   cells "a week per row". 365 cells at 4 cm do not fit one 1.5 × 0.833 m panel
   either way round (53 × 4 cm = 2.1 m); spilling onto a second panel would
   straddle a joint, which the spec forbids.
2. **Filled glow 0.1, not ~0.5.** Measured at the rest pose with 70 % of a year
   filled: at 0.5 every kept day was countable (spec/05 §3's own failure
   test), at 0.2 still mottled; at 0.1 the band reads as a panel texture and
   the days resolve at the focus pose. Today stays at 0.9.
3. **Day order:** oldest first, column by column; today is the last cell. Rows
   are not aligned to weekdays — at rest it is texture, and the panel carries
   the numbers.

---

## 2026-09-28 — Phase 3.4: the notebook and the journal panel

**Done; the lighting test reads TRUE** (hardware-GL probe of the production
build, bloom on — the same method as 3.3, for the same reason).

- **Panel** — `app/(app)/panels/JournalPanel.tsx` renders `/text`'s
  `JournalBody`: the privacy copy, mood and tags, the reflect control (still
  hidden while `NEXT_PUBLIC_AI_REFLECT` is off), the AI Insight block and the
  calendar. One implementation, so FR-3.6 and AC-3.3 hold on both surfaces.
  The entry lives in component state only; closing the panel drops it.
- **Scene** — `journal.todayLogged` lerps the notebook's bookmark emissive
  0 → 0.15 (spec/05 §3). Measured at the focus pose: the bookmark's mean red
  rises 86 → 127; rest-pose lighting numbers unchanged
  (pool 0.248 · keyboard 20.4 %).

**PROPOSED:** the bookmark carries the glow, in `SIGNAL` (L 0.474 × 0.15 =
0.071, under the bloom threshold). spec/05 gives the intensity, not the
surface or the colour.

**Owner decisions:** AC-4.5's reading from 3.3 (bars at rest, titles on
approach) — **accepted 2026-09-28**.

**Carried:** `/favicon.ico` is a 404 on every first load — the icons come only
through the manifest. Pre-existing; a `<link rel="icon">` would end it.
Not verified signed in: saving an entry from the room, and the bookmark
warming after a real save.

---

## 2026-09-28 — Phase 3.3: monitor 2 and the goals panel

**Done; the lighting test reads TRUE, effects on and off.**

- **Screen** — `scene/screens/goalsScreen.ts`: up to four goals, a bar each,
  "and N more" beneath; the fill is paper over a dark track, so progress is
  light. Glow holds at 1.0 (spec/05 has no intensity row for monitor 2).
  The shared canvas code moved to `scene/screens/canvasScreen.ts`.
- **Panel** — `app/(app)/panels/GoalsPanel.tsx` renders `/text`'s `GoalsBody`
  (timeline, milestones, new goal), so the two surfaces share one implementation.

**Lighting, measured — and the 3.1 inference closed.**

```
rest, bloom on              pool 0.248 · monitors 0.081 / 0.057 · floor 0.025 · keyboard 20.4 %
worst case, bloom on        pool 0.248 · monitors 0.096 / 0.057 · keyboard 20.5 %
                            (monitor 1 done at 1.4, phone importing, five goals on monitor 2)
reduced motion              all five TRUE
```

These frames come from a hardware-GL Playwright probe of the production
build. **Why not `capture:states`:** it renders through SwiftShader (on the CPU,
for GPU-less CI), and on a busy machine the adaptive-FPS guard trips during
load and drops bloom — every `capture:states` frame today was bloom-off under
the effects-on name. Bloom-on at monitor 1 = 1.4 is now measured rather than
inferred (0.096 vs pool 0.248). `captures/` is still not refreshed; CI's
`scene-capture` is the SwiftShader record.

**AC-4.5, PROPOSED reading.** At the rest pose the four bars and their fill
are clear; the titles (~8 px) are not. The bars are the summary; titles
resolve at the focus pose, and the full detail is in the panel. A bigger
summary would fight the 5 % rule (spec/05 §3). Raise if the owner wants the
titles legible from the desk.

**Not verified signed in** — the panel's timeline and check-off with real
goals. Signed out: monitor 2 → "No goals yet" + sign in, no console errors.

---

## 2026-09-28 — Phase 3.1 and 3.2: monitor 1 and the phone

**Both done; the lighting test reads TRUE after each, effects on and off.**

| task | state | where |
|---|---|---|
| 3.1 monitor 1 | canvas texture (title, action, source host) redrawn on change; glow lerps 1.1 → 1.4 on completion, hover clamped at 1.4; room panel with do-it-now, roll, and an empty state that glides to the phone | `scene/screens/challengeScreen.ts`, `scene/objects/ChallengeMonitor.tsx`, `Monitor.tsx`, `app/(app)/panels/ChallengePanel.tsx` |
| 3.2 phone | screen lerps `GLOW_COOL_SOFT` @ 0.35 → `SIGNAL_DIM` @ 1.1 while `importing`; room panel with link/text, status line, preview, self-close | `scene/objects/Phone.tsx`, `app/(app)/panels/ImportPanel.tsx` |

Both panels share `lib/challenge/copy.ts` with `/text`, so the two surfaces say
the same things. `lib/motion/lerp.ts` is the one lerp for state-driven surfaces.

**Lighting, measured** (`pnpm lighting:test`, production build):

```
rest, bloom on     pool 0.249 · monitors 0.081 / 0.058 · floor 0.025 · keyboard 20.4 %   (was 0.088 at 1.2)
worst case         pool 0.254 · monitors 0.094 / 0.058 · keyboard 15.4 %   monitor 1 @ 1.4 + phone importing
reduced motion     all five TRUE
```

The worst-case frame came out with **bloom off**: the adaptive-FPS guard tripped
because the owner's own room tab was rendering at the same time, and a rebuilt
normal frame then read identically (15.4 %), so the cause is load, not the
change. Bloom barely moves monitor 1's region (0.081 on vs 0.080 off), so
criterion 1 at 1.4 holds with a wide margin — measured with bloom on in the
3.3 entry (0.096 vs 0.248). For the same reason **`captures/` was not refreshed**:
a bloom-off frame under the effects-on name is the mislabel the capture script
warns about. Re-capture on a quiet machine, or read CI's `scene-capture`.

**Verified in the browser (production build, signed out):** monitor 1 → panel
empty state → "pick up the phone" glides to the phone → "sign in to import". No
console errors. **Not verified:** the signed-in import in the room, the phone
warming during a real extraction, and monitor 1 at 1.4 after a real completion
— I do not sign in. The owner's dev server has all of it.

**PROPOSED — raise with the owner:**
1. **The phone lies face up.** It was face down (portfolio), but spec/05's
   phone-screen row cannot be seen against the desk.
2. **Phone emissive levels.** Rest 0.35 (L 0.046, under the bloom threshold —
   a phone left on, not a light), importing 1.1 (L 0.126, the level of monitor
   1 on an ordinary day). The spec gives the colours, not the intensities.
3. **Import panel self-close dwell: 3 s**, cancelled by any touch or key in
   the panel; an unreadable page keeps it open because its message says what
   to do next.
4. **Monitor 1 text is dark ink on the glow.** Light text on a dark screen
   would drop most of the screen under the 0.1 threshold (D-20's regression).

**Carried:** shell now 185.4 of 200 KB (panels + `/text`'s type styles).

---

## 2026-09-25 — Phase 2 track B: agents, /text and the offline shell

**All nine tasks done locally; the gate reads TRUE.** Unpushed at the time of
writing — see "Owner actions" below.

| task | state | where |
|---|---|---|
| B2.1 prompts, schemas, ≥ 20 fallbacks | done — verbatim V1 templates, 24 fallbacks | `lib/prompts/` |
| B2.2 `AgentProvider` + provider | done — plain fetch, errors leave as a code only. **Now `GeminiProvider`** (see the Gemini note below) | `lib/agents/provider.ts`, `gemini.ts` |
| B2.3 `/api/agent/extract` | done — SSRF guard in the socket's DNS lookup, 8 s, 6000 chars, retry once, fallback | `lib/agents/extract.ts`, `fetchPage.ts`, `ssrf.ts` |
| B2.4 `/api/agent/reflect` | done — no body logging (comment in the route), codes only | `lib/agents/reflect.ts` |
| B2.5 atomic rate limiting | done — `consume_rate_limit()`, 429 + `Retry-After` to local midnight | `017`, `lib/agents/ops.ts` |
| B2.6 `agent_logs` on every path | done — tokens, latency, a code | `lib/agents/ops.ts` |
| B2.7 hourly seeder | done — pg_cron in the database (owner decision), route behind `CRON_SECRET` | `018`, `app/api/cron/seed-challenges/` |
| B2.8 `/text`, all four features | done — challenge + import, habits, journal, goals + SVG timeline | `app/(app)/text/`, `lib/data/` |
| B2.9 PWA | done — manifest, service worker caching the `/text` shell only, per-user offline snapshot | `public/sw.js`, `app/manifest.ts`, `lib/data/snapshot.ts` |

```
pnpm test      74 pass · 0 fail   (no database, no network)
pnpm test:db   72 pass · 0 fail   (isolation gate, functions, both agents, the dump gate)
bundle:check   shell 181.1 / 200 KB gz · scene 232.5 / 320 KB gz · shell free of three.js
```

**The gate, and that it can fail.** `supabase/tests/reflect.test.ts` runs a
full reflection with distinctive words in the entry, confirms the entry really
reached the provider, then `pg_dump`s the whole database — every schema — and
finds none of them; the stored summary is found, so the dump is real. Making
`reflect.ts` write the entry into `ai_next_action` failed exactly that test.
Blocked-network: the real provider (now `GeminiProvider`) with a fetch that throws, for both
agents. Other mutations checked the same way: removing the once-per-goal check
in 021, and removing the DNS-level address check in `fetchPage.ts` (exactly the
two name-based tests failed).

**Verified in the browser (production build):** `/text` signed out renders all
five sections in the room's voices, no console errors, no overflow at 375 px.
The service worker activates and caches `/text`, its CSS, fonts and scripts —
no dev or 3D chunks. With the server stopped, `/text` still loads from cache
and `/` falls through to it. Phones: `/` → 307 `/text`; `/?room=1` sets
`bbe_room` and stops the redirect; desktops are never redirected. The mobile
scene capture uses a desktop user agent, so track A's frames are unchanged.
**Not verified: the signed-in half of `/text`** — the agent does not create
accounts or type passwords. The owner walks it once: import, complete, roll,
habit check-off, journal save and reflect, a goal with milestones.

**PROPOSED — flag in review:**
1. Award paths live in the database (019–021): callable by the signed-in user,
   acting on `auth.uid()` only, amount decided in SQL. 03 §4 carries a note.
   Two bounds added: only today's challenge awards; habit awards stop at ten a day.
2. A failed or rate-limited reflection saves mood and tags and stores **no**
   AI fields; the gentle fallback is shown, never stored as an insight.
3. An unreadable URL (blocked, not HTML, gone) still yields a curated action,
   plus a quiet line suggesting the user paste the text.
4. Extra log codes beside the four provider codes: `SOURCE_UNREADABLE`,
   `LIMITER_UNAVAILABLE`. A 429 is not logged — no call was made.
5. A rate limiter that cannot be reached never calls the provider, and serves
   a fallback rather than a false "used up today".
6. Mood set (8) and topic tags (8) in `lib/journal/moods.ts`; calendar colours
   per FR-3.5's proposal.
7. The offline snapshot in `localStorage`, per user, cleared on sign-out.

**Raised, not fixed — owner decisions:**
1. **Owner-writable history.** 012 lets a user write `habit_logs` and
   `daily_challenges` directly, so they can backfill a streak to farm the +50
   weekly bonus (bounded: one per habit per day) and reset `roll_count` past
   D-15's cap. Only their own room is affected. Fix would be select-only
   policies on both, with writes through 019/020 — a change to 012.
2. **Goal farming.** Create a goal with one milestone, complete it, +100;
   repeat. The spec has no bound. Options: once per day, or a minimum age.
3. **No record of the prompt version** behind a stored row (04 §7 asks for it);
   no table has a column for it.
4. **The model may quote the entry in its summary.** The gate passes with a
   scripted provider; a real summary that quotes a phrase would put a fragment
   in the database. Proposed: a `JOURNAL_ANALYSIS_V2` rule, "do not quote the
   entry".
5. **Support resources are unverified.** `lib/support/resources.ts` — 988 (US),
   Samaritans 116 123 (UK/IE), findahelpline.com. Check each against the
   service's own site and set `VERIFIED_ON` (D-13: human-verified).

**Owner actions:**
- ~~Push migrations 017–021 to the hosted project~~ — done by the owner, 2026-09-25.
- Put `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` in the env
  (`CRON_SECRET` optional). Leave `NEXT_PUBLIC_AI_REFLECT` empty.
- Walk the signed-in `/text` once (above).

**Gemini, 2026-09-25 (owner decisions).** OpenAI had no free tier; the owner
has a Google AI Studio key. Two decisions: **Gemini replaces OpenAI** (D-19
amended, `OpenAIProvider` deleted), and **the free tier runs imports only** —
its terms let inputs improve Google's products and be read by reviewers, so
journal entries must not go there. AI Reflect is behind `NEXT_PUBLIC_AI_REFLECT`,
off by default: the route then saves mood and tags, spends no rate limit and
calls nothing (tested), and the form says the words are not kept. Prompts are
`_V2` — identical text, model `gemini-2.5-flash-lite`. **Not yet verified
against the live API**: the model name and the `thinkingConfig` field are from
the docs as known, not from a call. Once the key is in the env, one real import
settles both; a wrong model name shows as `PROVIDER_ERROR` in `agent_logs` and
the user still gets a fallback. Raise when a paid key exists: Gemini's safety
filters may block a distressed entry, which would drop the D-13 resource block
— lower the dangerous-content threshold for the journal call before switching
AI Reflect on.

**Carried:** the shell is at 181 of 200 KB, most of it supabase-js — watch it.
Icons are SVG only; iOS wants a PNG `apple-touch-icon` (Phase 4). `archive` on a
habit has no confirmation step.

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

**Phase 1 track B is done locally; the gate reads TRUE.** All six tasks are
committed (one commit per migration). Not pushed.

| task | state | where |
|---|---|---|
| B1.1 auth, SSR sessions | done | `lib/supabase/`, `middleware.ts`, `app/auth/`, `app/(auth)/` |
| B1.2 migrations 001–011 | done, applied cleanly to a fresh local stack | `supabase/migrations/` |
| B1.3 migration 012, RLS | done | `supabase/migrations/012_rls_policies.sql` |
| B1.4 migration 013 | done, behaviour tested | `supabase/migrations/013_functions.sql` |
| B1.5 generated types | done, threaded through the clients | `lib/supabase/database.types.ts`, `pnpm db:types` |
| B1.6 `lib/data/` skeleton | done | `lib/data/` — hydrates clock + points |
| **gate** | **TRUE — 24/24** | `supabase/tests/isolation.test.ts`, `pnpm test:db` |

```
pnpm test:db   40 tests · 36 pass · 0 fail · 4 todo (the known gaps below)
```

**The gate was shown to be able to fail**, because a gate that passes on its
first run could be passing vacuously. With `own_habits` replaced by
`using (true)` on the live local database, exactly two tests failed —
`read habits as B` and `write habits as B` — and nothing else. `supabase db
reset` restored the migrations and the run went green again.

**Local stack:** `pnpm exec supabase start` (Docker Desktop must be running),
then `pnpm test:db`. The CLI is a devDependency, 2.117.0; CI runs the same
pinned version.

**Not yet verified on a runner.** The CI `database` job starts a local stack,
runs `pnpm test:db`, and fails if `database.types.ts` no longer matches the
migrations. It has run only locally in pieces, never on GitHub — confirm the
first run step by step, as the 2026-09-24 CI entry below learned to.

**Before pushing to `main`: check the Supabase GitHub integration.** The hosted
project is linked to `defurl/goal-tracker`. If its "deploy to production"
option is on, pushing `supabase/migrations/` to `main` applies them to the
hosted database — which the owner wanted to review first. Confirm it is off, or
review 012 and accept that the push deploys it. Otherwise pushing migrations
means `supabase link` with the database password, which the owner runs.

**The hosted project has no schema yet** — no tables, so nothing exposed. No
real data until 012 is live there.

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
   only with the revoke. Same for the seeder. Tested in the X-6 block, and
   noted in `03-data-model.md` §7 so nobody "simplifies" it away.
2. **`handle_new_user()` is new — PROPOSED.** A trigger on `auth.users` that
   creates the `profiles` row. The spec never says who creates it, and the
   seeder reads FROM profiles, so without it nobody would ever be seeded.
3. **Every security-definer function pins `search_path`.** Standard hardening;
   not in the spec's SQL.

**Owner decisions, 2026-09-24 — all raised gaps closed.** Each was a `todo`
test, shown failing before its fix and passing after; `pnpm test:db` now reads
41 pass, 0 fail, **0 todo**, stable over repeated runs. Amendment notes are in
the LOCKED docs, dated, with the original text left intact.

| raised | decision | where |
|---|---|---|
| a row could point at another user's parent row | a fault — forbidden | `014_parent_ownership.sql`: composite foreign keys `(parent_id, user_id)`, so it holds for the service role too. 03 §7 note |
| a null `ref_id` defeated award idempotency (Perfect Day twice a day) | `nulls not distinct` | `015_award_idempotency.sql`. 03 §4 note |
| habit cap: concurrent-insert race + un-archive bypass | fix both | `016_habit_cap.sql`: per-user advisory lock, trigger also on `update of archived_at`. The race reproduced every run before the fix. 03 §2 note |
| `GoalCategory` disagreed with the enum | the schema's six | `lib/stores/app.ts` now derives the type from the generated enum |
| signed-out visitor to `/` | default room; signed in, their own room | `lib/data/hydrate.ts` + `app/(app)/SessionHydrator.tsx`, re-hydrating on auth events. spec/05 §7 note — shared, track A needs nothing new |
| how to sign in without menus | corner control, bottom-right (08 §5 global controls) | `app/(app)/AccountControl.tsx`, on the room and `/text`; hides while a panel is open |

**PROPOSED, flag in review:** `hydrate()` records the browser's timezone on a
profile still at the `UTC` default, so the seeder's midnight is the user's. A
zone the user set is never overwritten.

**Verified in the browser:** the default room shows `sign in` bottom-right and
links to `/login`; the form renders; no console errors; no network call without
a session. **Not verified: the signed-in half** (sign up → own room → sign
out). The agent does not create accounts or type passwords into sign-in forms,
even throwaway local ones — the owner walks it once. To do it against the local
stack rather than the hosted one, put the local URL and anon key from
`pnpm exec supabase status` in a `.env.local`, which overrides `.env`.

**Scene captures:** with a `.env` configured, the corner control appears in
local `capture:states` frames; CI has no env, so its frames are unchanged. No
light-emitting or light-blocking change, so no lighting re-run was needed.

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
