# 13 — The Door Scene ("the hall")

> Status: **PROPOSED** — the design note build plan A5.7 asks for, for the
> owner to approve before any door-scene code (A5.8, A5.9). Scope is D-24 §8:
> *one scene with both views: the full-size tree, in a space whose surfaces
> carry the habit history; `/text` gets a history view in the same phase.*
> Every number here is a starting value to be tuned against the acceptance test
> in §5, the way the room's were. The questions the owner has to answer are in
> §9.
>
> Lighting plan: `13-hall-lighting-plan.svg` (10-tech-stack: "make an
> equivalent for any new scene").

---

## 1. The idea in one paragraph

The room's door spill has always implied a lit space off-frame (04: "a light
source off-frame implies a space off-frame"). The hall is that space. You step
through the warm doorway at camera-left and stand in a long, quiet concrete
hall — the same Ando wall as the room, continued. In the middle of the floor
stands the bonsai grown to full size, in a stone planter, under its own warm
pendant. Behind it, the whole back wall is your year: one faint line of kept
days per habit, set into the concrete like the tie-rod holes. From the doorway
it reads as texture on a wall. Walk up to it and it reads as a record. Nothing
in the hall is counted in 3D; the numbers are in the DOM panel.

It stays **nocturnal** (D-03). It is not a dashboard (D-04): there is one tree,
one wall and a doorway, and each is an object you can approach.

---

## 2. The space

Its own coordinate frame: **`y = 0` is the hall floor** (the room's `y = 0` is
the desk top; this scene has no desk). 1 unit = 1 m. As in the room, only what
the camera sees is built, and nothing is "completed" (04).

| element | placement | notes |
|---|---|---|
| Floor | 10 × 10 plane at `y = 0` | the room's floor material (06), so the two read as one building |
| Back wall — **the history wall** | 7 × 2.6 m at `z = -1.5`, centred on `x = 0` | Ando concrete, joints and tie-rod holes as the room's back wall (04) |
| Left wall, with the doorway | `x = -3.5`, doorway 1.0 × 2.1 m at `z = 0.6` | the doorway back to the room; the room's warm light spills through it |
| Right wall, with a clerestory | `x = 3.5`, a tall slot window 0.35 × 1.6 m high on it | the cool side; its sky plane follows `localHour` as the room's window does (lib/sky.ts) |
| No ceiling, no front wall | — | as the room: the camera never looks up or back (07) |
| The tree | planter at `[-0.6, 0, -0.5]` | §3 |
| The pendant | shade at `[-0.6, 2.3, -0.4]` | the key light's source, a shade like the desk lamp's (04) |

---

## 3. The full-size tree

**The same tree, at scale.** `Bonsai.tsx` becomes parameterised (position,
scale, and whether it may animate) and the hall mounts it a second time. The
leaf layout is the same deterministic PRNG, so every leaf is where it is on the
desk — the owner's tree, not a new one.

- **Scale ×5 over the desk tree** (TREE_SCALE 0.88 → 4.4): the top pad at
  ≈ 1.45 m, a small tree at standing height. The pot becomes a 0.66 × 0.44 ×
  0.2 m stone planter. PROPOSED.
- **Leaves:** 8 base plus `points.leafCount`, capped at 64 (lib/growth.ts),
  exactly the desk tree's. Leaf tone starts at the desk's `DATA_GREEN × 0.25`
  and is re-checked under the pendant, as it was under the bulb.
- **No droplet and no reveal here.** Leaves are earned at the desk; the hall
  shows them (`leafArrival` is ignored). Nothing grows while you look at it.
- The 0.35 m cap is the desk tree's (it keeps monitor 1 clear, D-11); it does
  not bind the hall.
- **Glide only** (08 §4): activating the tree moves the camera to look up into
  it; no panel. PROPOSED — see §9.

---

## 4. The history wall

The wall carries the history (D-24 §8). One **line** of cells per habit, a year
long, set into the concrete at eye height:

- **365 cells per habit, oldest at the left, today at the right**, a 1.5 cm
  pitch — a 5.5 m line. Rows 4 cm apart, active habits first (at most 10,
  FR-2.1), in the order of the habits panel. One `InstancedMesh`, as the room's
  wall grid (D-23 §5): one draw call for every cell.
- **A kept day is a cell lit at `SIGNAL_DIM` × 0.1**; a day not kept is the bare
  recess, unlit. Today is `SIGNAL` × 0.9 on the rows that kept it. Exactly the
  room wall's states, so a kept day looks the same in both places.
- **The longest run is the only emphasis:** its cells sit at 0.2 instead of
  0.1. The longest streak is the number D-09 makes primary; on the wall it is a
  slightly warmer stretch of line, never a label. PROPOSED — see §9.
- **Nothing marks a miss.** No red, no gap marker, no end-of-streak notch
  (11-anti-patterns, D-09). A habit with no kept days is a bare line of recesses.
- **No numbers on the wall** (11: percentages belong in the DOM panel).
- Archived habits: see §9.

At rest the band is texture — the room's 5 % rule (spec/05 §3): nobody should
be able to count days from the doorway. At the wall's focus pose the lines are
legible and the panel carries the numbers.

---

## 5. Lighting: the five roles, and the hall's acceptance test

The same five roles and six instances as the room (05). **No seventh light.**
Intensities are placeholders; the **ratios to the key are the room's** and are
what must hold (05: "if you rescale the rig for a different room size, keep
these ratios").

| role | instance | placement | colour | starting value | ratio to key |
|---|---|---|---|---|---|
| **KEY** | pendant `pointLight`, sole shadow-caster | `[-0.6, 2.2, -0.4]` | `LAMP_WARM` | 14.0, distance 4.5, decay 2 | 1.00 |
| **FILL ×2** | `spotLight` pair washing the history wall from the floor | `[-2.0, 0.1, -0.9]`, `[2.0, 0.1, -0.9]`, aimed up the band | `GLOW_COOL` | 5.6 each | 0.40 |
| **RIM** | `directionalLight` from the clerestory | `[3.3, 2.0, -0.8]` toward `[0, 1, -1]` | `GLOW_COOL_SOFT` | 2.1, rising with the hour as the room's (RIM_STATES) | 0.15 |
| **DOOR SPILL** | `pointLight` outside the doorway | `[-4.2, 1.2, 0.6]` | `LAMP_WARM` | 6.2, distance 3.5 | 0.44 |
| **AMBIENT** | `ambientLight` | — | `BG_NIGHT` | 0.28 | 0.02 |

The spill is the room itself, seen from outside: warm light through the door you
came in by. Temperature runs as it does in the room, **warm left, cool right**.

**Acceptance test — all five must read TRUE**, in a lighting-only capture of
the hall at rest, effects on and off, at noon and midnight (A5.4's extremes):

1. **The tree's pool is the brightest area in frame** — the floor and planter
   under the pendant, against the history band, the clerestory and the doorway.
2. **The right edge reads measurably cooler than the left.**
3. **A warm rectangle lies on the floor at camera-left** — the doorway's spill.
4. **The history wall is texture at rest and a record up close.** At rest the
   band's mean luminance is at most 40 % of the tree pool's and no cell is
   brighter than the pool's mean; at the wall's focus pose a kept cell and a
   bare recess differ clearly (a luminance gap the test states in numbers).
   This replaces the room's keyboard criterion, which has no subject here.
5. **No object is pure black and none is ambient-flooded**; the pool peak is
   under 1.

`scripts/lighting-test.ts` gains a hall region set; CI captures and tests the
hall as it does the room.

---

## 6. Camera

No free orbit (07). Three poses:

| pose | position → target | notes |
|---|---|---|
| **arrival** (rest) | `[-2.4, 1.55, 2.4]` → `[0.2, 1.0, -1.2]` | just inside the doorway: tree left of centre, the wall behind it, the clerestory at the right edge |
| **the wall** (glide + panel) | `[0.9, 1.25, 0.9]` → `[0.9, 1.2, -1.5]` | the most recent months of every line left of the history panel; tuned against a render |
| **the tree** (glide only) | `[-1.7, 1.0, 0.8]` → `[-0.6, 1.1, -0.5]` | looking up into the canopy |

Glides are the room's: 2200 ms, easeInOutCubic, interruptible (07). Portrait:
the arrival pose gets a portrait variant, as the room's rest does.

---

## 7. Getting there and back

**In:** the room gains the door's hit disc at `[-1.0, -0.73, 0.3]`
(`circleGeometry(0.45)`, invisible), label **"step through"** (the portfolio's
precedent). Activating it:

1. the camera glides to the existing `door` pose (2200 ms);
2. the screen fades to `BG_VOID` (400 ms);
3. the scene swaps and the hall is compiled (ShaderWarmup, as the room);
4. the hall fades in at its arrival pose (400 ms).

2200 + 400 + 400 = `--dur-scene` (3000 ms), the token that has been waiting for
this (03). **Under reduced motion:** no glide — straight to the fade, the
crossfade 03 prescribes in place of camera moves (principle 5).

**Back:** "back to the room" at bottom-left (08 §5) and Escape: fade out, the
room at its rest pose, fade in. From the wall or the tree pose, the first press
returns to the hall's arrival pose and the second goes back through the door, as
the room's back returns to the desk first.

**Mounting.** One `<Canvas>`, one WebGL context: `useSceneStore.current` becomes
`'room' | 'hall'` and the canvas mounts one scene or the other. The hall is its
own chunk (`next/dynamic`/lazy), fetched when the door is first hovered or
armed, never before (10: "do not preload a deep scene from the entry scene").
It counts toward the single scene budget (D-10, 320 KB gz; the room is at ~237).
No route change. PROPOSED.

**Offline:** the service worker never caches the 3D bundle (B2.9). If the hall's
chunk has not been fetched this session, the door says "the hall needs a
connection" on hover and does not open.

---

## 8. Data, the DOM panel, and /text

**Store.** A new slice, written by lib/data like every other (spec/05 §6):

```ts
history: HistoryRow[] | null; // null until first loaded
interface HistoryRow {
  id: string; name: string; type: 'build' | 'break';
  archived: boolean;
  longestStreak: number; // habits.longest_streak — D-09's primary number
  currentStreak: number; // computed from the days below, see note
  days: DayCell[];       // 365, oldest first, this habit only
}
```

Loaded on first entering the hall or opening /text's history, and kept in the
offline snapshot. One query over `habit_logs` (SELECT-only to its owner since
022) for the last 365 days, plus `habits` including archived ones. The scene
reads it from the store and never from the network (spec/05 §1); two new rows
join spec/05 §3 (`history` → wall cells, `points.leafCount` → the hall tree).

Two things the research turned up, fixed here:
- the store today has only the **combined** day grid, and it quietly includes
  archived habits' days while `habits` excludes them. `history` is per habit
  and says which rows are archived.
- the stored `streak` is recomputed only inside `log_habit()`, so after a missed
  day it is stale until the next check-off. `currentStreak` is computed from
  `days` in a pure, tested function; `longestStreak` stays the stored value (its
  lookback is 400 days, longer than the wall's year).

**The history panel** (top-right, 440 px, 08 §5): one entry per habit — its name,
**longest N days** first, *now M* beside it (D-09), and *kept K days this year*.
A list, not cards (D-04). Signed out, or with no habits: a welcome, not zeros
(X-1): "Your kept days will line this wall."

**/text (A5.9, D-07).** A History section with the same list, and under each
habit its last twelve weeks as a small calendar strip (the existing `.calendar`
styles). No 3D, no three.js (D-10).

---

## 9. Questions for the owner

1. **The space.** The hall as described (an interior concrete hall continuing
   the room), or a night courtyard (open sky, the tree in the ground, history on
   paving stones — more atmosphere, and a sky and a garden to build)?
2. **The shape of the history.** One year-long line per habit across the wall
   (a timeline, §4), or a 53 × 7 block per habit like the room's wall, blocks
   side by side?
3. **Archived habits.** On the wall after the active ones, treated the same (the
   panel says "archived"), or left off the wall and only in the panel?
4. **The longest run.** Marked on the wall as a slightly warmer stretch (§4), or
   no emphasis at all?
5. **The tree.** Glide only (§3), open the habits panel as the desk tree does,
   or not interactive?

---

## 10. What this note does not change

The room: its rig, its test and its layout stay exactly as they are, apart from
the door's hit disc and label. D-03, D-04, D-07, D-09, D-10 and
`11-anti-patterns.md` bind the hall as they bind the room.
