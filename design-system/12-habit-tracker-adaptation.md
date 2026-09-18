# 12 — Adapting the Room to the Habit Tracker

> **Status: REVISED for Be Better Everyday (BBE), 2026-09-18.**
> Documents 00–11 are extracted fact. This document is the agreed BBE adaptation.
> Key decisions locked: Daily Challenge on monitor 1, Goal Dashboard on monitor 2,
> Article Import on phone, bonsai tree at `[-0.8, 0, 0.1]` (desk, confirmed).

---

## 1. What is fixed

The room itself. Reproduce `04-room-spec.md` and `05-lighting-rig.md` as
written, then dress it differently. Specifically these carry over unchanged:

- coordinate system (`y = 0` at desk top, floor at `−0.74`)
- floor, back wall, right wall-with-window segmentation
- Ando concrete joints and tie-rod holes
- the desk (2.0 × 0.9 × 0.04, walnut drawers, brass handles)
- the five-light rig and its intensity ratios
- material bands, shadow policy, bloom settings
- the four atmosphere layers
- the interaction grammar and the DOM corner allocation
- the whole token palette

What changes is **what sits on the desk and what the state means.**

---

## 2. Object mapping

| portfolio object | position | habit tracker role | change required |
|---|---|---|---|
| Monitor 1 "primary" | `[-0.3, 0.306, -0.4]` | **Daily Challenge.** Today's action card — title, 2-minute prompt, source article. Emissive amber intensity tied to challenge completion (1.1 → 1.4; see §3.1). | keep geometry; canvas texture driven from store |
| Monitor 2 "terminal" | `[0.5, 0.27, -0.4]` | **Goal Dashboard** — goals list with progress and target dates. Cool analytical register suits reviewing progress. | keep geometry; cool emissive stays |
| Lamp | `[-0.95, …]` | unchanged — key light, the room's anchor | none |
| Plant | `[-0.8, 0, 0.1]` | **retired; replaced by bonsai task tree.** Same position, new geometry. Capped at 0.35 m — never occludes monitor 1. | plant mesh removed; tree mesh at same coords |
| Notebook | `[-0.4, 0, 0.05]` | **reflection / journal** panel | keep |
| Phone | `[0.7, 0, -0.1]` | **Article Import** — URL capture portal. You see something on your phone, put it on the desk (click), the AI extracts a 2-minute micro-action. Panel: URL field + extracted challenge preview. | keep geometry; new panel content |
| Headphones | `[0.85, 0.045, 0.15]` | focus-session / ambient audio toggle | keep as-is |
| Keyboard | `[0, 0.011, 0.2]` | dressing | keep |
| Mug | `[-0.55, 0, 0.15]` | dressing — good candidate for a *time-of-day* tell (steam in the morning) | optional |
| Window | `[1.98, 1.0, -0.3]` | **time of day / weather**, not market state | rewire the state source |
| Door spill | `[-1.0, -0.73, 0.3]` | route to a second scene (history? the tree at full size?) | keep the pattern |
| — | back wall | **the daily tracker grid** | new |
| — | desk-left or floor | **the goal tree** | new |

---

## 3. The three new mechanics

### 3.1 The Daily Challenge on Monitor 1 / Goal Dashboard on Monitor 2

**Monitor 1 (amber, warm)** is the first thing you look at. In BBE that is the
Daily Challenge — today's action card, generated from an article the AI agent
processed.

- Canvas texture driven from the store (not `<Html>`): challenge title in
  **Fraunces italic**, 2-minute prompt in **Departure Mono**, faint source URL at bottom.
- **Completion → emissive intensity.** Challenge done maps from **1.1 → 1.4**.
  (Corrected 2026-09-18 from the 0.6 → 1.4 originally proposed here — 0.6 falls
  below the bloom threshold. See `../spec/01-decisions.md` D-20.)
  When you complete today's challenge, the monitor literally warms the room more.
  That is the reward loop, and it costs nothing extra.
- The DOM panel (on click) shows the full extract, AI-generated micro-action,
  and a "Done" button. In-world it is only light.

**Monitor 2 (cyan, cool)** shows the **Goal Dashboard**: a compact list of
active goals with progress bars. The cool emissive suits the analytical
"overview" register. Clicking slides in the full goal detail panel.

### 3.2 The task tree, watered by completions

This is the one genuinely new object, and the one most likely to break the room.
Constraints it must satisfy:

- **It cannot sit in the lamp pool.** The lamp pool at camera-left is the
  brightest area in frame and the acceptance test depends on that. A tall tree
  there would cast a hard shadow across the whole desk from the only
  shadow-casting light.
- **It cannot occupy the right side.** That is the cool zone and the window's
  rim light; a warm organic mass there breaks the temperature gradient.

Recommended placement: **on the floor, camera-left and forward of the desk**,
roughly `[-1.35, -0.74, 0.55]` — inside the door spill's warm rectangle rather
than the lamp pool. The door spill (`intensity 3.5`, `distance 2.5`, warm) then
becomes the tree's key light, which gives the tree its own small pool of warmth,
separate from the desk's. The camera's existing `door` focus pose
(`position [-0.4, 0.7, 1.2]`, `target [-1.4, -0.74, 0.3]`) already looks almost
exactly there — retarget it to the tree and you get the focus glide for free.

**Confirmed placement: desk at `[-0.8, 0, 0.1]`**, replacing the plant.
Bonsai scale, capped at 0.35 m. The door spill remains available as a transition
to a second scene (streak history / full-size tree view).

Build notes:
- **Instance the leaves.** Leaf count grows with completed tasks; an
  `InstancedMesh` with a per-instance matrix is the only version of this that
  stays inside the perf budget. One draw call.
- Growth is **slow and additive**. Use `--dur-reveal` (900 ms) for a single new
  leaf appearing, not a spring bounce.
- Leaf colour: derive from `DATA_GREEN` at reduced scalar, as the existing plant
  does (`multiplyScalar(0.35)`). Do **not** introduce a green token —
  `--data-green` is reserved for live data, and a leaf *is* live data here,
  which makes the derivation legitimate.
- **The watering event is the one place a sharp sub-second motion is allowed**
  (`--dur-tick`, 180 ms). Per `03-motion.md`, fast motion is reserved for
  live-data events; a completion is exactly that. A brief `--voxel-glow` droplet
  falling into the pot, then 900 ms of growth. Nothing else.
- **Never shrink, wilt, brown or drop leaves.** See `11-anti-patterns.md`.
  Absence of growth is already the signal. Decay is punishment.

### 3.3 The daily tracker on the wall

The back wall is currently a 4 × 3 Ando panel grid, 6 m × 2.5 m at `z = -1.2`,
with joint lines at `y = 0.09 / 0.92` and `x = -1.5 / 0 / 1.5`.

**Put the tracker inside one panel and let the concrete grid frame it.** A
single panel is 1.5 m × 0.833 m. Panel *centres* — not the joint lines — sit at
`x = -2.25, -0.75, 0.75, 2.25` and `y = -0.3235, 0.4930, 1.3095`. The panel
directly behind and above the monitors is centred at **`x = -0.75, y ≈ 0.493`**;
the row above (`y ≈ 1.310`) is the alternative if the monitors occlude too much
from the rest pose. Centre the grid on a panel centre — centring on a joint line
(`y = 0.92`) would straddle the groove instead of being framed by it.

Proposal:
- A **7 × N grid of small emissive quads** (a week per row), each ~4 cm,
  inset 2–3 mm proud of the wall exactly like the joint lines are.
- **Three states, all in existing tokens:** unfilled = `INK_GHOST`, non-emissive
  (reads as another tie-rod detail); filled = `SIGNAL_AMBER_DIM` emissive at
  ~0.5; today = `SIGNAL_AMBER` emissive at ~0.9, the only cell bright enough for
  bloom to catch.
- Use an `InstancedMesh` with per-instance colour. A year is 365 quads — one
  draw call, negligible cost.
- At rest-pose distance the grid should read as **texture, not as data**. The
  legible version is the DOM panel when clicked. This is the same 5 % rule the
  window uses: state visible in the environment, readable only on approach.
- Wrap it in an `InteractiveObject` with label `"tracker"` and a new focus pose
  — camera glide toward the wall, panel slides in from the right with the real
  numbers.

### 3.4 The phone as the article import portal

BBE's entry mechanic — save a URL, AI extracts a 2-minute micro-action — needs
a physical entry point in the room. The phone is that portal.

- **Narrative fit:** you see something interesting on your phone; you put it on
  the desk (click it); it becomes a challenge. The object and the action agree.
- **In-world feedback:** phone screen emissive brightens while
  `content_extraction_agent` runs (~1.3 s), lerping from `VOXEL_GLOW_SOFT`
  toward `SIGNAL_AMBER_DIM`. When done, monitor 1's canvas texture updates.
- **DOM panel:** URL input, status line ("extracting…" / "ready"), extracted
  challenge preview. Submits on Enter. Panel closes on completion — it is
  transient, not a settings screen.
- Settings have no place as a 3D nav target. Put them in a top-right overflow
  or the `/text` fallback route, not on the phone.


---

## 4. Lighting consequences

The rig is balanced; three additions perturb it. Re-run the five-item acceptance
test in `05-lighting-rig.md` §4 after each change.

- **Tree on the floor at camera-left** → sits in the door spill. Check
  criterion 3 ("a warm rectangle of light is visible on the floor at
  camera-left") still passes with the tree occluding part of it. You may need
  to nudge the spill's Z, but do not raise its intensity past the lamp's.
- **Wall tracker emissives** → total emissive area on the back wall goes up.
  With `luminanceThreshold` at 0.1 the bloom pass will catch the "today" cell.
  That is desirable; a full row of bright cells would not be. Keep only the
  current day at high intensity.
- **Goal-progress emissive on monitor 1** → at completion (intensity 1.4) the
  monitor is brighter than it has ever been. Verify criterion 1 ("the lamp pool
  is visibly the brightest area in frame") still holds at full progress. If it
  doesn't, cap the range at 1.2.

**Do not add a seventh light instance** for the tree or the wall. Use the existing spill
and emissives.

---

## 5. State-to-environment mapping

The window's pattern — a lookup table of `{ color, intensity }` per state,
lerped at `k = 0.05` per frame, snapped under reduced motion — is the template
for every ambient state signal in the new app.

| signal | surface | mapping |
|---|---|---|
| time of day | window sky plane | table keyed on morning / day / dusk / night |
| weather (optional) | window rain density | drop count 0 → 18 |
| today's completion % | monitor 1 emissive intensity | 1.1 → 1.4 |
| streak length | tree leaf count (instanced) | additive only |
| today's cell | wall tracker instance colour | `SIGNAL_AMBER` |

Everything lerps. Nothing pops. The numbers live in the DOM.

---

## 6. The one open question: does the room stay nocturnal?

The portfolio room is permanently 3 a.m. — the design spec says "there is no
light mode and we are not building one," and the entire five-light rig assumes
darkness. A habit tracker is used in the morning.

Three options, in order of cost:

1. **Stay nocturnal.** Zero work, total fidelity to the extracted system, and
   the room keeps its character. The window's sky plane still shifts with real
   time of day, so the room acknowledges morning without becoming bright. **This
   is the recommended default** — it is the only option that preserves the
   lighting rig exactly as documented.
2. **Nocturnal room, daylit window.** The sky plane goes to a bright cool value
   in the morning and the rim light intensity rises with it (`1.2 → ~2.5`).
   The room stays dark; the outside does not. Moderate work, re-run the
   acceptance test at the extremes.
3. **Full day cycle.** The lamp dims and the ambient/rim rise toward midday.
   This is effectively a second lighting rig and a second acceptance test, and
   it puts every material's roughness choice back in question. Expensive. Do not
   attempt this before the nocturnal version ships.

**Decide this before the first frame is drawn**, because it determines whether
`05-lighting-rig.md` is a spec or a starting point.

---

## 7. Suggested build order

1. Reproduce the empty room — floor, three wall segments, Ando detailing, desk,
   the light rig. Screenshot it and run the acceptance test. Nothing else.
2. Port the token palette (all three mirrors) and the colour lint. Wire the
   scene store, reduced-motion hook and `useAdaptiveFps`.
3. Add the lamp, monitors, keyboard, mug, notebook, phone, headphones. Verify
   shadows and the warm/cool gradient.
4. Add bloom, dust motes, film grain, window rain. Re-verify the acceptance test
   with effects both on and off.
5. Port `InteractiveObject` and the camera rig. Wire hover labels and one focus
   pose end-to-end before building the rest.
6. Then, and only then, build the three new mechanics — goal screen, tree, wall
   tracker — one at a time, re-running the acceptance test after each.

Resist building the tree first. It is the exciting part and it is the part most
likely to break the lighting that makes the room worth reusing.
