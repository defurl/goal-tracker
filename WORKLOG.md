# Worklog

What has been built, feature by feature and surface by surface, in the order it
landed. `PROGRESS.md` is the handoff — state, measurements, open decisions;
`git log` is the commit record. This file answers "what does the product do
today, and what does it look like", and is updated when a phase closes.

**As of 2026-09-30:** Phases 0–5 done, every gate TRUE. Deployment is the
owner's, and the UI rework is the next phase.

---

## Phase 0 — foundations (2026-09-18)

- Next.js 14 App Router, CSS Modules on `styles/tokens.css` (no Tailwind, D-01),
  Fraunces / Geist / Departure Mono self-hosted (D-02), permanently nocturnal (D-03).
- The palette in three live mirrors — `tokens.css`, `lib/style/colors.ts`,
  `design-spec.jsonc` — held together by `pnpm lint:colors`, which fails the
  build on any hex outside the palette. Accent is the dusty rose `--signal` (D-21).
- `pnpm bundle:check`: shell ≤ 200 KB gz, scene ≤ 320 KB gz, and `/text` must
  never pull in three.js (D-10).
- `lib/growth.ts` (points → leaves) and `scripts/capture-states.ts` (Playwright
  frames of every room state).

## Phase 1 track A — the empty room (2026-09-18)

- The room: floor, back wall, right wall around a window opening, Ando
  concrete detailing (form joints, tie-rod holes), the walnut desk with brass
  handles. `y = 0` is the desk top.
- The light rig: five roles, six instances, the desk lamp the only shadow-caster.
- Camera rig with a rest pose and slow glides; reduced-motion and adaptive-FPS hooks.
- `pnpm lighting:test` measures the five acceptance criteria off a capture and
  exits non-zero — all five TRUE before any object entered.

## Phase 2 track A — objects, atmosphere, interaction (2026-09-18 → 20)

- **Seven desk objects:** two monitors, the lamp, keyboard, notebook, phone,
  headphones.
- **The window:** a city plane and a sky plane behind glass.
- **Atmosphere:** bloom, dust motes, film grain and window rain, each behind the
  perf gate and removed entirely under reduced motion.
- **`InteractiveObject`, the one interaction wrapper:**
  - hover label
  - on mobile, a first tap arms and a second tap within 3 s activates
  - a hidden 48×48 button per object, so every object is keyboard-reachable
  - a focus ring
- **Focus poses:** each object gets a camera pose that keeps it left of centre,
  clear of the panel, and a back control and Escape return the camera to rest.
- **CI:** builds, captures, and asserts the lighting test with effects on and off.

## Phase 1 track B — the data foundation (2026-09-24)

- **Auth:** Supabase email auth with SSR sessions. Google sign-in is built but
  hidden behind `NEXT_PUBLIC_AUTH_GOOGLE`.
- **Database:** migrations 001–016 for 12 tables.
  - Every RLS policy is in one file, 012.
  - `award_points()` is the only path to points.
  - A cap of 10 active habits.
  - `journal_entries` has no column able to hold entry text (FR-3.6).
- **Gate:** the cross-user isolation test. All 24 attempts to read or write
  another user's data fail.
- **`lib/data/`** is the only writer to the app store.

## Phase 2 track B — agents, `/text`, offline (2026-09-25)

- **Article import** (`/api/agent/extract`): paste a link or text and get one
  concrete action for today's challenge.
  - SSRF guard at the DNS level, 8 s timeout, 6000-char cap, one retry.
  - A curated fallback if anything fails, so the user never sees an error.
  - Runs on Gemini `gemini-2.5-flash-lite` (D-19 amended).
- **AI Reflect** (`/api/agent/reflect`): mood and tags are saved, the entry text
  never is, and the request body is never logged.
  - Off behind `NEXT_PUBLIC_AI_REFLECT` while the key is on Gemini's free tier.
- **Around the agents:**
  - atomic per-user rate limits, with a 429 until local midnight
  - `agent_logs` on every path
  - an hourly challenge seeder in pg_cron
  - 24 fallback actions
- **`/text`, the mobile fast path, with all four features:**
  - daily challenge plus import, with complete and roll
  - habits with check-off
  - journal with mood, tags, privacy copy and calendar
  - goals with milestones and an SVG timeline
- Phones are redirected from `/` to `/text`; `?room=1` opts back into the room.
- **PWA:** manifest, and a service worker that caches only the `/text` shell, so
  `/text` still works offline. A per-user offline snapshot is kept locally and
  cleared on sign-out.
- Award paths for challenges, habits and goals are in migrations 019–021, with
  the amounts decided in SQL.

## Phase 3 — the room comes alive (2026-09-28)

Every row of spec/05 §3 is wired to real data. Each one eases in, and snaps
under reduced motion.

**3.1 Monitor 1 — the daily challenge.**
- **Screen:** today's title, the action and the source site, drawn as dark ink
  on the glowing screen.
- **Completing the challenge:** the screen reads "done today" and the glow warms
  from 1.1 to 1.4.
- **Panel:**
  - "do it now"
  - roll for another challenge
  - an empty state whose "pick up the phone" button glides the camera to the phone

**3.2 Phone — article import.**
- The phone now lies face up.
- The screen shifts from cool to rose while an import is running.
- **Panel:** link or text, a status line and a preview. It closes itself 3 s
  after a save; any touch or key cancels that.

**3.3 Monitor 2 — goals.**
- **Screen:** up to four goals, each a paper-coloured progress bar, then "and N more".
- The bars are readable from the desk and the titles at the focus pose (the
  owner accepted this reading of AC-4.5).
- **Panel:** timeline, milestones and a new-goal form, shared with `/text`.

**3.4 Notebook — the journal.**
- **Panel:** privacy copy, mood, tags, the reflect control while it is hidden,
  the AI insight and the calendar.
- The entry lives only in the open panel.
- The bookmark warms faintly once today is logged.

**3.5 Wall tracker — habits.**
- **The grid:** 365 cells (53 × 7) on the back-wall panel, one per day.
- **Glow:**
  - kept days glow faintly, so the band reads as wall texture from the desk
  - today is the one bright cell
  - hovering lifts the glow
- **Panel:** `/text`'s habits list under one totals line: days kept this year,
  glow points. There is no count of missed days.

**Floating detail panel (owner decision).**
- Clicking an object zooms the camera in, then the content fades up in a
  floating 440 px panel at the top right, after a 1.2 s wait and a 600 ms fade
  with an 8 px rise.
- This replaces the portfolio's full-height slide-in. It appears instantly under
  reduced motion.
- **Portrait framing:** on a portrait screen, phone or upright tablet, the
  camera re-derives each pose so the object sits centred under the panel.

**3.6 Bonsai — growth.**
- **The tree:**
  - on the desk in the lamp's pool
  - a matte pot and an S-shaped trunk
  - four pads of leaves
- **Leaves:** eight base leaves are always there, so a new user's tree never
  reads as dead. Up to 64 more are earned from points.
- **A new leaf:** announced by a small cool droplet, then grows in over 0.9 s.
- No leaf is ever taken away. Clicking the tree opens the habits panel.

**3.7 Window — the sky by the hour.**
- Five bands, exactly as in spec/05 §5: night, dawn, day, dusk, evening.
- A one-minute clock keeps the hour current, in the profile's time zone.
- A page load snaps straight to the right sky rather than fading in from night.

**3.8 Headphones — focus mode and ambient sound.**
- **Two switches:** the headphones and a "sound off / sound on" control in the
  bottom-right corner, which always agree.
- **The sound:** a synthesised lo-fi bed of chord pad, room hum, rain-like noise
  and an occasional gust. It fades to 0.3 volume over 600 ms.
- **Off by default:** sound is off on every visit, and Tone.js downloads only on
  the first click. It has its own 100 KB budget (PROPOSED).

### What the room looks like now

- **At rest:**
  - a dark concrete room at night
  - the lamp's warm pool on the desk, where the bonsai sits
  - two glowing monitors: today's challenge on the left, goal bars on the right
  - the notebook, the phone lying face up, the headphones
  - a faint year-grid on the back wall with one bright cell for today
- **Window:** off to the right, it changes with the hour.
- **Atmosphere:** dust, grain and rain drift unless reduced motion is on.
- **Interaction:**
  - hovering an object shows its label
  - clicking an object glides the camera in and fades its panel up at the top right
  - Escape or back returns to rest
- **Corner controls:** sound, then the account control, at the bottom right.
- **`/text`:** all of the above as plain text, for phones and offline use.

### Numbers at the Phase 3 gate

- **Lighting (rest, bloom on, fully grown tree):** lamp pool 0.218,
  keyboard 23.2 %, pool peak 0.945 (the limit is < 1). All five criteria
  are TRUE, with effects on and off.
- **Bundle:** shell 184.1 / 200 KB gz, scene 236.1 / 320 KB gz, audio 76.3 / 100 KB gz.
- **Tests:** 117 unit tests. The database suite of 72 tests passed at the
  Phase 2 track B gate.

---

## Phase 4 — hardening (2026-09-29)

Nothing new to see; everything checked.

- **Speed:** the first frame no longer links every shader at once
  (`ShaderWarmup`), and the room scores 0.96 on desktop Lighthouse. `/text`,
  login and signup score 0.99 as a phone. CI holds `/text` and auth to their
  budgets on every push.
- **Accessibility:** axe over every DOM route at two sizes and over the room
  with each panel opened from the keyboard. Informative text is 4.5:1.
- **Reduced motion:** proven, not assumed. Two frames a second apart are
  identical at rest and with a panel open.
- **Empty states:** nothing shows a signed-out or empty state for a moment
  before the real one; a new visitor sees welcomes, not zeros.
- **Offline:** `/text` reloads from the service worker with the network off,
  and an open room keeps working when the network drops.
- **Privacy:** `/privacy`, linked from the journal and auth, leads with the
  fact that entries are never stored.
- **Two-press actions:** archive (and, from Phase 5, account deletion) arm on
  the first press and fire on the second, within 3 s.

---

## Phase 5 — the backlog and the door (2026-09-30)

**Room backlog.**
- **The window** is glide only: the camera turns to it and nothing opens.
- **The headphones' two-minute timer.** Focus on starts it; the count shows
  beside the sound control, and at two minutes the bed fades out. On `/text`,
  a silent Focus section with the same timer.
- **Mug steam** rises faintly at dawn only.
- **The daylit window:** by day the sky brightens and the rim light with it;
  the room stays nocturnal.
- **The bonsai, rewired and moved.** Each new leaf gets its own droplet, one at
  a time; leaves that arrive by loading appear at once. The tree now sits at
  `[-0.6, 0, 0.2]`, the mug behind the headphones (D-11 amended), and the pool
  peak dropped from 0.94 to 0.68.

**Account and limits.**
- A plan per user (`free`), read-only to them; the AI's daily caps come from
  the plan.
- **Delete account**, beside sign-out on both surfaces: every row goes, and the
  AI logs keep their rows without the user.

**The door and the hall.**
- The room's warm floor spill is a door. "Step through": the camera glides,
  the room fades out, and the hall fades in.
- **The hall:** a tall concrete space with the bonsai grown full size under a
  pendant, a doorway and a clerestory. It has five light roles and its own
  five-criterion lighting test.
- **The history wall:** one year-long line per habit, archived ones after the
  active ones, with the longest run a little warmer and today the one bright
  cell.
- **Its panel:** each habit's longest streak first, "now" beside it, and the
  days kept this year.
- The hall is its own chunk, fetched on the door's first hover.
  `?scene=hall` links straight to it.

**History on `/text`.**
- The same list, last on the page. Under each habit, its last twelve weeks as a
  small strip, a week to a column. It loads only when scrolled near.

### What the product looks like now

- **The room** as at Phase 3, plus the window's glide, the countdown beside
  "sound on", steam at dawn, a brighter sky by day and the tree in its new
  spot. The floor spill says "step through".
- **The hall** behind it: the tree in its pool, the wall of years, the doorway
  back.
- **The corner:** sound, then delete account and sign out.
- **`/text`:** challenge, import, habits, journal, goals, focus and history, as
  plain text, for phones and offline use.

### Numbers at the Phase 5 gate

- **Lighting:** TRUE in all five sky bands, and at noon and midnight with
  effects on and off. The pool peak is at most 0.687 in every room state. The
  hall is TRUE at noon and midnight, effects on and off.
- **Bundle:** shell 187.8 / 200 KB gz, scene 240.8 / 320 KB gz (the hall
  included, the shell free of three.js), audio 76.3 / 100 KB gz.
- **Tests:** 160 unit tests. The database suite checks isolation across 13
  tables, plus plans and deletion.

---

## Not built, or not wired, yet

- **Sound on `/text`:** there is no sound control there, because audio is
  ambient rather than one of the four features (D-23 §10).
- **Reminders:** not sent (D-24).
- **The UI rework:** its own later phase, reviewed and partly designed by the
  owner.
- **Signed-in room flows, never walked by the agent:**
  - an import from the phone
  - a real completion taking monitor 1 to 1.4
  - a journal save warming the bookmark
