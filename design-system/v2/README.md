# Design System v2 — Be Better Everyday

**Started:** 2026-10-29, under `../../spec/01-decisions.md` D-26.
**Status:** a value that cites a decision is **LOCKED**. Everything else is
**PROPOSED** until it is built, captured and approved by the owner.

## Sources

| source | what it settles |
|---|---|
| `../references/Personal_Growth_Space_UI_UX_Specification_EN.docx` (v1.0) | camera travel, anchors, tokens, grid, cards, screen blueprints, states, copy |
| `../references/Personal_Growth_Space_Functional_Specification_EN.docx` (v1.0) | the five modules, their MUST lists, data, AI boundaries, acceptance F-01 to F-10 |
| `../references/homescreen.jpg` | the room overview: the look, the anchors |
| `../references/dashboard.jpg` | the Today board: the benchmark for every board |
| D-26 and its amendment notes | where the owner settled the specifications against this repo |

The specifications call the product "Personal Growth Space". That is a working
title; the product is Be Better Everyday (D-26 §1).

## What this replaces

`../00` to `../13` describe the night room the product shipped through Phase 5.
They stay as its record, as `../tokens/` already is, and they are no longer
rules. Where they and v2 disagree, v2 wins.

Carried over from them because the decisions behind them still stand:

- the scene reads a store and never the network (spec/05 §1)
- motion is slow and ambient motion is removed, not reduced, under
  `prefers-reduced-motion` (D-05)
- every interactive object is reachable from the keyboard (spec/02 X-3)
- nothing in the interface judges the user (D-08, D-09)

## Reading order

| # | file | read when |
|---|---|---|
| 01 | `01-color.md` | any colour |
| 02 | `02-type.md` | any text |
| 03 | `03-layout-and-shape.md` | any board, card or control |
| 04 | `04-boards-and-motion.md` | navigation, the camera, transitions, states, copy |
| 05 | `05-room.md` | the 3D room, its assets, the shop's spots, budgets, the acceptance test |
| 06 | `06-anti-patterns.md` | **before proposing any UI pattern** |

## Not decided yet

- The display serif. The design team names it; Georgia is the fallback.
- The room plan: each anchor's camera transform and the furniture spots. The
  design team delivers them with the blockout (P0).
- Tints for chips and tags (`dashboard.jpg` shows peach, sage and lavender).
- Any 3D asset. None exists yet (D-26 §11).

Until P1, the code's three token mirrors still hold the night palette.
