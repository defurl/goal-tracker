# 08 — Preparing the UI revamp

Written 2026-10-30. The design team is producing the detailed design, in Figma
or as HTML. Until it arrives we prepare: gather what the build needs, agree how
we turn a design into code quickly, line up the data each screen needs, and
clear out what is in the way. **No new UI is built before the design lands.**

## 1. Materials we have

| what | where | state |
|---|---|---|
| Room and board references | `design-system/references/homescreen.jpg`, `dashboard.jpg` | concept art; the menu in `homescreen.jpg` is painted into the image |
| Functional and UI/UX specifications (v1.0) | `design-system/references/*.docx` | read; reflected in D-26 |
| Visual contract | `design-system/v2/` (colour, type, layout, boards and motion, room, anti-patterns) | tokens and rules agreed; exact sizes wait for the design |
| Colour tokens | `styles/tokens.css`, `lib/style/colors.ts`, `design-spec.jsonc` (`--v2-*`) | nine role tokens, contrast-checked; `lint:colors` enforces |
| Body font | `@fontsource/inter` (dev dependency) | installed |
| Stand-in 3D room | `scripts/p0/room/` builds it from CC0 Poly Haven assets (licences in `captures/p0/room/assets.json`); outputs in ignored `.p0/` | proves the pipeline; not the design team's art |
| Room measurements | `captures/p0/room/report.json` | budgets pass with WebP; KTX2 numbers in |
| Board readability test | `scripts/p0/board-check.ts`, `captures/p0/board-*.png` | the 40% tint is the rule |
| Device journal | `lib/journal/deviceStore.ts`, `pnpm journal:check` | passes in three engines |

## 2. What we need from the design team

One handoff, either form. Each item is what lets us build without guessing.

**If Figma**
- Colours, radii and spacing as Figma **variables named by role** (`canvas`,
  `surface`, `ink`, `ink-muted`, `line`, `interactive`, `signal`), matching
  the nine `--v2-*` tokens, or a note of each change so the three mirrors move together.
- Components (button, input, chip, card, menu item, ring, meter, tag) with their
  states: default, hover, focus, disabled, pressed, error.
- Every board at 1440 px and at 390 px, with its states: loading, empty, filled,
  saving, saved, failed (functional specification §2).
- Icons as SVG, one stroke weight.
- Dev Mode access, or an export, for us. Our Figma connector needs one sign-in
  by the owner (`/mcp` in a terminal) before it can read the file.

**If HTML**
- One page per board, plain HTML and CSS, no build step. Colours as CSS custom
  properties named by role. We port the CSS into CSS Modules (D-01) and the
  markup into components; their JavaScript, if any, is reference only.

**Either way**
- Copy for every state, especially empty and error states (no red, no shaming).
- The room: a blockout GLB with the five anchors and the furniture spots named,
  then the baked art (`design-system/v2/05-room.md`, "deliverables").
- Furniture and decorations for the shop: name, spot, price, one image each.

## 3. How we build it fast

1. **Kit first, once.** Port the design's components into one kit
   (`app/(app)/ui/`), styled only with tokens. Every board uses it; no board
   styles its own button.
2. **One board at a time, end to end.** For each board: layout from the
   design → wire to existing data (§4) → empty, loading and error states →
   both surfaces (room page and `/text`, D-07) → checks → push. Today first,
   then Journal, Growth Map, Self Care, Skills, Settings.
3. **Checks per board**, scripted so they cost nothing: `lint:colors`,
   `board-check` (contrast from pixels, focus rings), `a11y:check`,
   typecheck and unit tests. One screenshot beside the design frame for the
   owner.
4. **Room last, in parallel.** The baked room drops in behind the same boards;
   the boards do not wait for it. Until it lands, boards sit over a still.
5. **Push to `main` when the checks pass** (CLAUDE.md, "How we work").

A first draft of the kit and the six boards was written on 2026-10-30, ahead of
the design, and parked (git stash "boards draft 2026-10-30"). It is a
reference for wiring, not a design; the design team's files replace its look.

## 4. Data each board needs

| board | exists today | missing before or during the build |
|---|---|---|
| Today | challenge, habits due today, points, week from `dayGrid`, greeting | today's mood and energy (from the device journal) |
| Journal | device store: save, list, search, delete-all, export, import | J01's four check-in answers, single-entry delete, guided prompts with versions, the week's counts (J04) — drafted in the stash |
| Growth Map | goals with milestones, habits (repeating actions), the year's history | goal paused and archived states (G02), before/after snapshots (G04) |
| Inspiration Inbox | import of link or text into an action | **save only after approval, and say plainly when a page cannot be read** (D-26 §8): the import saves straight away and falls back to a stock action today. A draft mode is in the stash |
| Self Care | nothing | the activity catalogue, sessions, feedback, routines. A seed catalogue (15 activities, 6 checked links) is in the stash |
| Skills | nothing | the resource catalogue (14 checked links in the stash), saves, progress, private takeaways |
| Settings | sign-out, delete account (in the old corner control) | sign-out deleting the device journal after a warning, AI consent per module, export |
| Shop | points total | spent points and balance, catalogue, purchases — new tables and a server function (D-08); **needs the owner's go for the hosted database** |

Device-only data (journal text, Self Care notes, Skills takeaways) stays in the
browser; the server never receives it (FR-3.6 as amended).

## 5. Room pipeline decisions

- Bake in Blender (Cycles), render unlit; meshopt geometry.
- **Textures: WebP now.** It holds every budget (first view 3.51 MB). KTX2
  ETC1S cuts GPU memory to a quarter but misses the 5 MB budget by 8 KB at
  default settings and adds a 585 KB transcoder. Revisit with the real art,
  tuned, when phone performance matters.
- The bake reads about 20% darker in the browser than in Cycles (no glossy in
  the bake). The design team should judge colour in the browser harness, not
  in Blender's render.

## 6. Cleaning up

**Done 2026-10-30:** five merged agent branches deleted; 560 MB of scratch
bake output deleted from `.p0/`.

**Retires when the new UI replaces the room page** (it serves the live site until then):
- `scene/` (40 files: the night desk, the hall, the screens)
- `app/(app)/panels/`, `DetailPanel`, `SceneNav`, `SceneFade`, `AccountControl`, `AudioControl`
- `lib/stores/scene.ts`, `lib/stores/interaction.ts`, `lib/scene/`, `lib/sky.ts`, `lib/leafSchedule.ts`
- `/text`'s night-styled sections (rebuilt as boards)
- `scripts/lighting-test.ts`, `capture-states.ts`, `zone-for-hour.ts` and the night captures in `captures/local/`
- Fraunces, Geist and Departure Mono; the night tokens; `design-system/00`–`13` move to an `archive/` folder
- `public/p0/` (the P0 backdrop)

**For the owner:** keep or delete `backup-pre-rewrite` (6 commits from before a
history rewrite, 2026-09-18); `spec/security-hardening-prompt.md` is untracked.

## 7. Open questions

From D-26, still open: does a bought bonsai keep growing; who owns each
catalogue; which analytics tool; the Next.js upgrade; closing the Phase 6
board. New: Figma or HTML for the handoff, and when the first board arrives.
