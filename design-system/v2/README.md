# Design System v2 — Be Better Everyday

**Started:** 2026-10-29, under `../../spec/01-decisions.md` D-26; revised
2026-10-30 under D-27 (the 2.5D handoff).
**Status:** a value that cites a decision is **LOCKED**. Everything else is
**PROPOSED** until it is built, captured and approved by the owner.

## Sources

| source | what it settles |
|---|---|
| `../references/Personal_Growth_Space_UI_UX_Specification_EN.docx` (v1.0) | camera travel, anchors, tokens, grid, cards, screen blueprints, states, copy |
| `../references/Personal_Growth_Space_Functional_Specification_EN.docx` (v1.0) | the five modules, their MUST lists, data, AI boundaries, acceptance F-01 to F-10 |
| `../references/homescreen.jpg` | the room overview: the look, the anchors |
| `../references/dashboard.jpg` | the Today board: the benchmark for every board |
| `../PGS_Engineering_Handoff_v1_1/` (v1.1) | the 2.5D room, routes, transition states, art deliverables (D-27) |
| Figma `5AYqsHBJBV8QSKtmIQCSJA` | layout foundations for Home and the five modules |
| D-26, D-27 and their notes | where the owner settled the specifications against this repo |

The specifications call the product "Personal Growth Space" and the Figma file
shows "My little world". The site is called **"Focus on yourself"**; in the UI
the space is **"Your Space"**, renamable by the user (D-27 §9).

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
| 05 | `05-room.md` | the 2.5D room: views, the art contract, the manifest, transitions, budgets, the acceptance test |
| 06 | `06-anti-patterns.md` | **before proposing any UI pattern** |

## Not decided yet

- Component states and named variables: the Figma file has neither yet.
- The renders, the hotspot map and the safe areas: the art team delivers them.
- Which views each shop spot appears in, and the catalogue.

The three token mirrors hold the v2 palette as `--v2-*` beside the night
palette, which retires with the night room.
