# 08 — Preparing the UI revamp

Written 2026-10-30, revised the same day when the design team's engineering
handoff v1.1 and its Figma foundation arrived. We prepare; we do not build the
UI ahead of the design. The handoff's priority prototype is
**Home → Today → Home**, and it is the first thing built once the owner settles
the decisions in §2.

## 1. What the handoff changes

Source: `design-system/PGS_Engineering_Handoff_v1_1/` (read 01, 02, 03 in
that order; the two `00` files are the v1.0 specs we already had) and the
Figma file `5AYqsHBJBV8QSKtmIQCSJA` ("Editable UI Foundations").

- **No live 3D for the MVP.** The room is pre-rendered: one master Blender
  scene, rendered from a Home camera and five focus cameras (Today: coffee
  table; Journal: notebook corner; Growth Map: pinboard; Skills: study desk
  and books; Self Care: sofa and plant). The site ships images, transparent
  layers, a hotspot JSON and a transitions JSON — not geometry. Transitions are
  CSS: pan or zoom the overview, crossfade to the focus image, blur, reveal the
  panel. (doc 01 §1, §5; doc 02 §1-3; doc 03 §1)
- **The URL is the source of truth**: `/room`, `/today`, `/journal`,
  `/journal/:id`, `/growth`, `/growth/inbox`, `/self-care`, `/skills`,
  `/skills/:id`, `/settings/privacy`. Every route works directly, without the
  zoom. (doc 03 §2)
- **A transition state machine**: home → preloading → focusing → focused →
  exiting, plus fallback; latest click wins; a dirty draft is saved before
  leaving. (doc 03 §2)
- **Starting tokens** (to be confirmed): 1440 × 810 reference; spacing
  4/8/12/16/24/32/48; card radius 14-22 px; cream `#FFF9EF`, sand `#D7C4A5`,
  sage `#AEBFA8`, ink `#44392D`. (doc 01 §2; adopted, with 12 px corners — D-27)
- **Inspiration Inbox adds screenshot upload with OCR**, and a source-status
  machine (submitted → partial / available / unavailable → draft → approved).
  (doc 03 §5)
- **Figma is a layout foundation**, not final design: seven frames (Home,
  Today, Journal, Growth Map, Self Care, Skills, one card component), no
  component states, no named variables. Space title shown: "MY LITTLE WORLD".

What it confirms from D-26: boards of readable cards over a softened room, the
five modules, nothing drawn on a monitor, approval before any AI output is
saved, never inventing a summary of an unreadable source, journal privacy,
reduced motion as a full alternative, desktop first.

## 2. Decisions

The owner settled the nine conflicts on 2026-10-30: **D-27** in
`01-decisions.md`. In short: 2.5D room, no WebGL; corners at 12 px, no pills;
cream, sand, sage and brown ink (sand and sage as fills only); sentence-case
headings; Inter only; path routes, `/text` retires; CSS transitions first;
screenshot intake later; the site is "Focus on yourself" and the space is
"Your Space", renamable. The design team is told to hold 12 px and sentence
case.

Product calls the handoff leaves to us (doc 03 §9): first room theme, initial
number of goals, AI provider and quotas, sources supported at launch, privacy
and retention policy, mobile support level.

## 3. Materials

| what | where | state |
|---|---|---|
| Engineering handoff v1.1 | `design-system/PGS_Engineering_Handoff_v1_1/` | read; summarised in §1 |
| Figma foundation | figma.com file `5AYqsHBJBV8QSKtmIQCSJA` | viewed read-only; our Figma connector has no access until the file is shared with an editor seat |
| Earlier references and specs | `design-system/references/` | superseded where §1 says so |
| Visual contract | `design-system/v2/` | holds until §2 is decided; 05-room becomes the 2.5D asset contract |
| Colour tokens | `styles/tokens.css`, `lib/style/colors.ts`, `design-spec.jsonc` | `--v2-*`; change with §2 #3, `lint:colors` keeps the three in step |
| Inter | `@fontsource/inter` | installed |
| Blender stand-in room | `scripts/p0/room/`, CC0 assets with licences in `captures/p0/room/assets.json` | can render the six matched views as **placeholders** so the prototype is not blocked on art; real art replaces them |
| Board readability test | `scripts/p0/board-check.ts` | reusable for every board; the 40% wash rule stands |
| Device journal | `lib/journal/deviceStore.ts` | passes in three engines |

## 4. What we need from design and art

**Design (Figma):** the four colours as named variables; text styles; the
component set with states (nav item, hotspot, card, buttons, mood selector,
checklist row, editor, AI suggestion card — doc 01 §4); every screen in its
loading, empty, error and saving states; the 390 px layouts; copy for empty and
error states. **Share the file with an account our connector can use**, or turn
on Dev Mode for it.

**Art:** six matched renders (2560 × 1440 AVIF/WebP, archive PNG), mobile
crops, alpha foreground layers if any, the hotspot and transitions JSON, the
text-safe area per scene, and the rights record (doc 02 §3, §6).

## 5. How we build it

1. **Room renderer and transition controller first** — the P0 prototype
   (doc 03 §8): Home and Today renders, hotspot layer in normalised
   coordinates on the object-fit rectangle, the state machine, reduced-motion
   swap, persistent nav. Stand-in renders until the art lands.
2. **Kit next, once** (doc 03 §8 P1): tokens, controls, cards, layouts and
   screen states, matched to the Figma components.
3. **Then one route at a time**, end to end: layout → existing data (§6) →
   states → checks → push. Today, Journal, Growth Map, Self Care, Skills,
   Settings.
4. **Checks per route**, scripted: `lint:colors`, `board-check` (contrast from
   pixels, focus rings), `a11y:check`, typecheck, unit tests; plus doc 03 §7's
   room tests: 1280/1440/1920, hotspot mapping after crop, rapid clicks,
   back/forward, refresh mid-transition.
5. Push to `main` when the checks pass (CLAUDE.md, "How we work").

Proposed layout, from doc 03 §4 on our conventions: `app/(app)/[route]/` for
routes; `features/room/` (ThemeRenderer, HotspotLayer, TransitionController);
`features/<module>/`; `components/ui/`; `content/catalogs/`;
`public/room/<theme>/`. CSS Modules and tokens (D-01) stay.

A first wiring draft of the boards from before the handoff is parked (git stash
"boards draft 2026-10-30"); it is reference for data wiring only.

## 6. Data each screen needs

| screen | exists today | missing |
|---|---|---|
| Today | challenge, habits due, points, the week, greeting | today's mood and energy (device journal); "focus" self-report (Figma shows Energy and Focus out of 10) |
| Journal | device store: save, list, search, delete-all, export, import | check-in answers, single delete, guided prompts with versions, weekly counts, autosave and recovery |
| Growth Map | goals, milestones, habits as repeating actions, the year | journey pause and archive, before/now snapshots, evidence timeline, the step-by-step goal setup |
| Inspiration Inbox | link or text into an action | approval before saving, plain "could not be read", source status labels; screenshots later (§2 #8) |
| Self Care | nothing | catalogue, sessions, feedback, routines |
| Skills | nothing | catalogue (topics in Figma: Languages, Communication, Creativity, Digital skills, Thinking and life skills), saves, progress, takeaways |
| Settings / privacy | sign-out, account deletion | journal warning on sign-out, AI consent per feature, export |
| Shop | points total | balance, catalogue, purchases — new tables; the owner's go for the hosted database |

## 7. Cleaning up

**Done 2026-10-30:** five merged agent branches; 560 MB of scratch bake output.

**If §2 #1 is adopted**, the whole WebGL stack retires with the night room:
`scene/` (40 files), `three`, `@react-three/fiber`, `@react-three/drei`, the
postprocessing packages, `lib/stores/scene.ts`, `lib/scene/`, `lib/perf/`,
`ShaderWarmup`, the bundle check's three.js rule, the P0 3D harness, and the
KTX2 tooling. **If #6 is adopted**, `/text` and its sections retire too.

Retires when the new routes replace the room page in either case:
`app/(app)/panels/`, `DetailPanel`, `SceneNav`, `SceneFade`, `AccountControl`,
`AudioControl`, `lib/stores/interaction.ts`, `lib/sky.ts`,
`lib/leafSchedule.ts`; `scripts/lighting-test.ts`, `capture-states.ts`,
`zone-for-hour.ts`; the night captures; Fraunces, Geist and Departure Mono;
the night tokens; `design-system/00`-`13` to an `archive/` folder; `public/p0/`.

**For the owner:** keep or delete `backup-pre-rewrite` (6 commits from
2026-09-18); commit or remove the untracked `spec/security-hardening-prompt.md`.
