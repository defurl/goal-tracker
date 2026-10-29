# 05 — The room

The approach, per D-26 and the owner's plan page (v2, 2026-10-29): **one
golden-hour light, baked in Blender** into the room's textures and shown unlit
in three.js, with a small live layer for what changes. The design team owns the
art (D-26 §11); none exists yet. **PROPOSED** unless a decision is cited.

## Anchors

From the UI/UX specification §2. The camera transforms arrive with the design
team's blockout.

| anchor | where the camera settles |
|---|---|
| Overview | the whole room, as `homescreen.jpg` frames it |
| Today | close on the coffee table: books, mug and plant in view |
| Journal | the open notebook on the coffee table |
| Growth Map | the inspiration board on the right wall |
| Skills | the right-hand desk and its books |
| Self Care | the sofa, plant and reading corner |

## Furniture spots

Bought items appear in a fixed set of spots (D-26 §6), because a baked room
cannot relight furniture that moves. Proposed spots: rug, wall art, shelf,
three plant spots, armchair, desk lamp, cushions, window sill.

- Each catalogue item is modelled for one spot and baked in place, so its
  texture carries the room's light.
- Each item ships a soft shadow texture for the floor or wall beneath it.
- Swapping items swaps the mesh and its shadow. The room's bake never changes.
- The bonsai is one of the shop's decorations (D-26 §6). Whether it keeps
  growing leaves once bought is open in D-26.
- Every item adds a model and a bake, so the launch catalogue stays small:
  about 12 items.

## The live layer

- The window's city view: one golden-hour still for now (D-26 §3).
- Bought items in their spots, and the bonsai's leaves if it grows.
- Ambient touches such as a pet breathing, removed under reduced motion.
- No interface on any screen (UI/UX §9).

## What the design team delivers

UI/UX §8, made specific:

- The room as GLB, with meshes named `anchor_*`, `spot_*` and `live_*`, and a
  second UV set for the bake.
- The baked textures as source PNGs; the pipeline compresses them.
- One GLB, baked texture and shadow texture per catalogue item.
- The camera transform for each anchor.
- Stills: one poster of the overview, and one blurred still per anchor.
- A licence for every asset that was not made in-house.

## Pipeline

- `gltf-transform`: meshopt for geometry, KTX2 for textures (ETC1S by default,
  UASTC where gradients band), 2048 x 2048 unless a surface needs more.
- `gltfjsx` only writes the components. Its `--transform` option shrinks every
  texture to 1024 x 1024 and is not used.
- The meshopt decoder (7.7 KB) and the KTX2 transcoder (245 KB wasm) are
  self-hosted, for offline use and the CSP.

## Budgets

| budget | value | holder |
|---|---|---|
| Route shell JS (`/text`, auth) | ≤ 200 KB gz | D-10, `bundle:check` |
| Scene JS chunk | ≤ 320 KB gz | D-10, `bundle:check` |
| Room assets, first view | ≤ 5 MB | new, `assets:check` |
| One catalogue item | ≤ 300 KB, loaded when placed | new, `assets:check` |
| Overview poster (the room's LCP) | ≤ 150 KB AVIF | new, `assets:check` |
| Each anchor's blurred still | ≤ 80 KB AVIF | new, `assets:check` |
| Frame rate | 60 desktop, 45 on a mid-range Android | 10-tech-stack §3 |

## Acceptance test

Replaces `../05-lighting-rig.md` §4 for the new room. Run with effects on and
off, at the overview and at every anchor.

1. At the overview, every hotspot name and the menu read at 4.5 : 1, and no
   anchor's object is hidden behind another.
2. No clipped highlights: under 0.5% of pixels at full white.
3. Bought items match the bake: within a set brightness of their surroundings,
   with their shadow present.
4. Board text holds 4.5 : 1 over every anchor's blurred view.
5. Under reduced motion: no camera travel, no ambient motion, and every module
   reachable.

## Later

- A room that follows the user's clock: a bake per time band, for the room and
  for every catalogue item.
- Room style presets (functional specification §1).
