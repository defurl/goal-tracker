# 05 — The room

**D-27 §1: the room is pre-rendered 2.5D.** One master scene in Blender,
rendered from a Home camera and five focus cameras, shipped as images with a
hotspot map and CSS transitions. No WebGL in the MVP. The design team's art
bible (`../PGS_Engineering_Handoff_v1_1/02_*`) owns the art; this file is the
contract between that art and the code. **PROPOSED** unless a decision is cited.

## Views

| view | anchor prop | route | composition |
|---|---|---|---|
| Home | the whole room | `/` | five hotspots readable; none under the top menu |
| Today | coffee table | `/today` | mug, notebook and sunlight; cards float in front |
| Journal | notebook and writing corner | `/journal` | book and pen toward an edge, room for the editor |
| Growth Map | pinboard | `/growth` | board in focus, a side left clear for the timeline |
| Skills | study desk and books | `/skills` | shelf readable behind the resource grid |
| Self Care | sofa, plant, calm corner | `/self-care` | quiet, with generous empty space |

Every view shows the same props, positions and grading as Home (art bible §6).
No interface is drawn on any screen in the room (UI/UX §9).

## What the art delivers, per theme

Names follow the art bible §3; `sunny` is the first theme.

- `public/room/sunny/home.avif` and `.webp`, 2560 × 1440; an archive PNG kept
  outside the app.
- `public/room/sunny/<view>.avif` and `.webp` for the five focus views.
- A tablet and a phone crop per view, or an `object-position` per view.
- Optional transparent layers (`layer-*.webp`), with clean alpha edges.
- `public/room/sunny/fallback-1280.webp`.
- `room-sunny.json`, below.
- A rights record per asset: id, author or source, licence, attribution,
  acquisition date, proof. Kept in the repo.

## The theme manifest

```ts
type RoomTheme = {
  id: 'sunny';
  overview: ImageSet;
  focuses: Record<'today' | 'journal' | 'growth' | 'skills' | 'selfCare', FocusScene>;
  hotspots: RoomHotspot[];
  layers?: { src: string; depth: number }[];
};
type ImageSet = { avif: string; webp: string; width: number; height: number };
type RoomHotspot = { id: string; route: string; x: number; y: number; radius: number; label: string };
type FocusScene = {
  image: ImageSet;
  /** Where the overview zooms toward, normalised 0-1 on the overview. */
  focal: { x: number; y: number };
  /** The part of the frame the cards may cover, normalised. */
  safeArea: { x: number; y: number; w: number; h: number };
  mobileCrop?: { objectPosition: string };
};
```

Hotspot coordinates are normalised to the image, then placed on the image's
rendered rectangle after `object-fit: cover`, so they stay on their objects at
any aspect ratio (handoff 03 §3).

## Transitions

From the handoff (01 §5, 03 §2), with D-27 §7 (CSS first):

- States: home → preloading → focusing → focused → exiting, and fallback.
  The latest click wins; a dirty draft is saved before leaving.
- Focusing: preload the focus image; scale the overview toward the focal point;
  crossfade to the focus image; raise the blur and the 40% ivory wash
  (`04-boards-and-motion.md`); then reveal the cards.
- Durations: 450-800 ms for the room, 120-200 ms for the panel. Proposed, to
  test.
- Reduced motion: an immediate swap, no scale, no parallax.
- Focus moves to the route's heading when the cards appear.
- Prefer a pre-blurred still to a live `filter: blur()` on a large layer if
  profiling shows the cost.

## The shop in a pre-rendered room

D-26 §6 puts bought furniture in fixed spots. In a pre-rendered room an item is
a transparent layer rendered from the master scene for each view it appears in,
with its shadow baked into the layer. Each item therefore costs one render per
view that sees its spot. The catalogue stays small; the art bible's §8 rules
out free placement. **Open:** which views each spot appears in, and the
catalogue.

## Budgets

| budget | value |
|---|---|
| Home image (the LCP) | ≤ 250 KB AVIF at 2560 × 1440 |
| Each focus image | ≤ 200 KB AVIF, loaded on intent or idle |
| One shop item layer | ≤ 60 KB per view |
| Route shell JS | ≤ 200 KB gz, as `bundle:check` holds today |
| Room transition | 60 fps on desktop; no layout shift |

Measured by an `assets:check` script once the first renders exist.

## Acceptance test

Replaces `../05-lighting-rig.md` §4. Run at 1280, 1440 and 1920 wide, and at
one tablet and one phone size.

1. Every hotspot sits on its object and its label reads at 4.5 : 1; none sits
   under the menu.
2. Every focus view matches Home: same props, positions and grading.
3. Card text holds 4.5 : 1 over every focus view with the wash on.
4. Rapid clicks, back and forward, a deep link and a refresh mid-transition all
   end on the right route.
5. Under reduced motion, every route works with no scale, zoom or parallax.
6. With the images missing, the fallback backdrop and the menu still work.

## Stand-ins

`scripts/p0/room/` builds a CC0 stand-in room in Blender
(`../../captures/p0/room/assets.json` holds its licences). It can render the
six views as placeholders so the Home → Today → Home prototype is not blocked
on the art. Its 3D-in-the-browser measurements (`report.json`) are the record of
the approach D-27 replaced.

## Later

- A second theme (the art bible's "Rainy Night Studio"): six more renders and a
  manifest.
- A real-time renderer, if free furniture placement is ever wanted (art bible
  §8). The theme manifest keeps navigation independent of the renderer.
