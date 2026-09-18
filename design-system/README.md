# The Room — 3D Design System

**Extracted from:** `D:\CODE\portfolio` (the "Night Desk" scene, Layer 1)
**Extracted on:** 2026-09-17
**For:** the habit tracker project
**Purpose:** reproduce the portfolio's 3D room — its geometry, lighting,
materials, camera and interaction grammar — in a new project with new mechanics.

---

## Read this first (agents)

This folder is a **specification, not a library.** Nothing here is wired into a
build. The source files under `references/source-extracts/` are verbatim copies
from the portfolio, provided as ground truth for the numbers in the specs — they
are **reference only and are not an optimised starter kit.** Re-implement
against the specs; consult the extracts when a spec is ambiguous.

### Reading order

| # | file | read when |
|---|---|---|
| 00 | `00-aesthetic-thesis.md` | **always, first.** The one sentence everything is judged against. |
| 04 | `04-room-spec.md` | **the core document.** Geometry, coordinate system, object inventory. |
| 05 | `05-lighting-rig.md` | building or touching any light. Contains the acceptance test. |
| 06 | `06-materials.md` | authoring any surface. |
| 07 | `07-camera.md` | framing, poses, glide. |
| 01 | `01-color-palette.md` | any time you need a colour. |
| 02 | `02-typography.md` | any text, in-world or DOM. |
| 03 | `03-motion.md` | any animation or transition. |
| 08 | `08-interaction-grammar.md` | making anything clickable. |
| 09 | `09-atmosphere.md` | grain, bloom, dust, rain. |
| 10 | `10-tech-stack.md` | project setup, dependencies, perf budget, tooling. |
| 11 | `11-anti-patterns.md` | **before proposing anything.** Hard no list. |
| 12 | `12-habit-tracker-adaptation.md` | applying all of the above to the new app. **Proposal, not fact.** |

Documents 00–11 are **extracted fact** from a shipped project. Document 12 is a
**proposal** and is meant to be argued with.

---

## The seven rules, if you read nothing else

1. **`y = 0` is the desk top**, not the floor. Floor is at `y = −0.74`.
2. **Five light roles, six instances** (the monitor fill is a matched pair) —
   and no more. One warm key (the lamp) is the only shadow-caster.
3. **Every value comes from the token palette.** A colour lint enforces it.
   Two hex exceptions exist (walnut, brass) and they are already spent.
4. **Motion is slow (600–2200 ms) and ambient motion never stops** — except
   under `prefers-reduced-motion`, where it stops completely.
5. **State shifts the environment by almost nothing** (the window moves 5 %
   toward its target hue). The readable version lives in a DOM panel.
6. **Objects are the navigation.** No menus. One shared wrapper gives every
   object the same hover / arm-tap / keyboard grammar.
7. **Re-run the five-item lighting acceptance test** (`05-lighting-rig.md` §4)
   after touching anything that emits or blocks light.

---

## Folder contents

```
design-system/
├── README.md                          ← you are here
├── 00-aesthetic-thesis.md
├── 01-color-palette.md
├── 02-typography.md
├── 03-motion.md
├── 04-room-spec.md                    ← the core document
├── 05-lighting-rig.md
├── 06-materials.md
├── 07-camera.md
├── 08-interaction-grammar.md
├── 09-atmosphere.md
├── 10-tech-stack.md
├── 11-anti-patterns.md
├── 12-habit-tracker-adaptation.md     ← proposal
├── tokens/
│   ├── design-spec.jsonc              ← the original aesthetic contract, verbatim
│   ├── colors.ts                      ← palette mirror #1 (TypeScript)
│   └── tokens.css                     ← palette mirror #2 (CSS custom properties)
└── references/
    ├── lighting-plan.svg              ← top-down lighting plan; open this
    ├── images/                        ← rendered reference frames
    └── source-extracts/               ← verbatim source, reference only
        ├── lighting.ts  cameraPoses.ts  CameraRig.tsx  DeskScene.tsx
        ├── InteractiveObject.tsx  HoverLabel.module.css  BloomLayer.tsx
        ├── globals.css  sceneStore.ts  interactionStore.ts
        ├── useAdaptiveFps.ts  reducedMotion.ts
        └── objects/  (12 files — DeskSurface, Lamp, Monitor, Window, Plant,
                       DustMotes, AndoWallDetails, Keyboard, Mug, Notebook,
                       Headphones, Phone)
```

### Reference images

| file | what it shows |
|---|---|
| `room-01-rest-pose.png` | the room at rest pose — the canonical frame. Warm lamp pool at camera-left, amber primary monitor, cool secondary monitor, cool fill on the keyboard. |
| `room-02-panel-open.png` | detail panel slid in from the right at ~480 px, in-world label suppressed |
| `room-03-rest-with-badge.png` | rest pose with the bottom-left status badge |
| `room-04-window-state-open.png` | window emissive planes in one state |
| `room-05-window-state-after-hours.png` | the same window in another state — note how small the difference is. That is the 5 % rule. |
| `room-06-checkpoint-c-rest.png`, `room-07-checkpoint-c-panel.png` | earlier build, rest and panel |

---

## Provenance and drift

Three files are mirrors of one palette and must change together:
`tokens/design-spec.jsonc`, `tokens/colors.ts`, `tokens/tokens.css`.

`references/lighting-plan.svg` is the original lighting contract. **The shipped
values differ from it in three places** (lamp distance, monitor fills as spot
lights rather than point lights, door-spill position and intensity) because the
plan's values failed the acceptance test. `05-lighting-rig.md` documents the
shipped values and the reason for each deviation — trust the markdown over the
SVG where they disagree, and read the SVG for the plan view and the ratios.
