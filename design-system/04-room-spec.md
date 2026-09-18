# 04 — The Room (Spatial Contract)

> This is the document that matters most. The room is what carries over from the
> portfolio project. Everything here is measured in **metres**, matching the
> Three.js world units 1:1. Reproduce these numbers exactly unless you have a
> reason written down.

---

## 1. Coordinate system

| Axis | Direction | Notes |
|---|---|---|
| `+X` | right (from the camera's POV) | window wall is at `+X` |
| `+Y` | up | **`y = 0` is the desk-top surface**, not the floor |
| `+Z` | toward the camera | camera sits at `+Z`, back wall at `−Z` |

**The single most important convention: `y = 0` is the desk top.**
The floor is at `y = −0.74`. Every object that sits on the desk is authored so
that its *lowest point* lands on `y = 0` — the `position.y` you pass is the
offset from the object's group origin down to its base, not an arbitrary lift.

Examples from the source:
- Monitor 1 (0.36 m bezel): `y = 0.306`
- Monitor 2 (0.30 m bezel): `y = 0.27`

  > The source comment gives the monitor foot offset as `height/2 + 0.12`, but
  > that yields 0.30, not the 0.306 actually used. The real geometry is
  > `height/2 + 0.12 + 0.006` — the extra 6 mm is half the thickness of the
  > 0.012 m foot disc. Applying the correct formula to Monitor 2 gives 0.276,
  > yet it ships at 0.27, so **Monitor 2 floats 6 mm above the desk**. Nobody
  > has noticed at rest-pose distance; fix it when you re-implement.
- Keyboard: `y = 0.011` (lower body extends 11 mm below the plate origin)
- Mug / Phone / Plant / Notebook: `y = 0` (group origin *is* the base)

If you add a new object, follow this rule or the scene's contact shadows break.

---

## 2. Room shell

### Floor
```
plane 10 m × 10 m
rotation [-PI/2, 0, 0]
position [0, -0.74, 0]
material: meshStandard · color BG_PANEL (#121826) · roughness 0.85 · metalness 0.05
receiveShadow: true
```

### Back wall
```
plane 6 m × 2.5 m
position [0, 0.51, -1.2]
material: same as floor
receiveShadow: true
```
Single solid panel. No cutout.

### Right side wall (the window wall)
Built as **four segments around a window opening**, not one plane with a hole.
Wall plane at `x = +2.0`, rotated `[0, -PI/2, 0]` so the normal faces `−X`
(toward the camera). Y range `-0.74 … +1.76`. Z range `-1.2 … +2.5` — it runs
forward *past* the camera so the right edge of frame reads as a real room edge
rather than void.

Window opening: **0.7 m wide × 1.0 m tall, centred at `(2.0, 1.0, -0.3)`.**
`z = -0.3` puts it roughly behind the monitors so it peeks past their right edge.

| Segment | position | plane args (w × h) |
|---|---|---|
| behind window | `[2.0, 0.51, -0.925]` | `0.55 × 2.5` |
| in front of window | `[2.0, 0.51, 1.275]` | `2.45 × 2.5` |
| above window | `[2.0, 1.63, -0.3]` | `0.7 × 0.26` |
| below window | `[2.0, -0.12, -0.3]` | `0.7 × 1.24` |

All four use the same floor/wall material and `receiveShadow`.

> **There is no left wall, no ceiling and no front wall.** The room is an
> open three-sided box. The darkness does the rest of the enclosing. Do not
> "complete" the room — the missing walls are why the lamp pool reads as the
> only lit thing in a much bigger dark space.

---

## 3. Tadao Ando concrete detailing

The walls are not flat colour. They carry a **raw board-formed concrete grid**:
panel joints + tie-rod holes. This one detail is doing most of the work that
separates the room from "grey boxes". Keep it.

**Back wall (6 m × 2.5 m):** divided into a 4 × 3 panel grid
(panels 1.5 m wide × 0.833 m tall).

*Joints* — thin inset boxes, `INK_GHOST (#2E3340)`, roughness 1.0, metalness 0,
sitting 2 mm proud of the wall (`z = -1.198`):
- 2 horizontal lines at `y = 0.09` and `y = 0.92`, size `[6.0, 0.005, 0.005]`
- 3 vertical lines at `x = -1.5, 0.0, 1.5`, size `[0.005, 2.5, 0.005]`

*Tie-rod holes* — `circleGeometry(0.015, 8)` in `BG_VOID (#05070D)`,
roughness 1.0, at `z = -1.196`. **6 per panel, 2 rows of 3**, offsets
`dx = [-0.5, 0, 0.5]` and `dy = [-0.25, 0.25]` scaled by `0.9` about the
panel centre. 4 × 3 panels × 6 = 72 holes.

**Right wall:** same treatment on the in-front-of-window segment only —
2 horizontal joints at `y = 0.09 / 0.92` along `z` centre `1.275` (length 2.45),
1 vertical joint at `z = 1.0`, and tie-rod holes at the cross product of
`z ∈ {0.4, 0.9, 1.6, 2.1}` and `y ∈ {-0.3, 0.5, 1.3}`, rotated `[0, -PI/2, 0]`.

Why it works: the joint lines catch the rim light and give the eye a scale
reference; the tie-rod holes read as depth at almost zero geometry cost.

---

## 4. The desk

```
top:    2.0 m wide × 0.9 m deep × 0.04 m thick
legs:   4 × cylinder r=0.025, inset 0.06 from the edge
floor:  0.74 m below the desk top
```

- Desk top is **centred at `z = -0.15`** (spans `z = -0.6 … +0.3`), origin
  centred in X (`x = -1.0 … +1.0`).
- Top material: `BG_PANEL`, roughness 0.85, metalness 0.05, `castShadow` + `receiveShadow`.
- Legs: `INK_GHOST`, roughness 0.4, metalness 0.7 — dark-metal coded, `castShadow`.
- Leg X at `±0.94`; leg Z at desk-centre `± 0.39`.

### Drawer cabinet undercut
Two walnut drawer boxes at `x = ±0.55`, `y = -0.115`, z = desk centre:
- body `boxGeometry [0.42, 0.15, 0.84]`, colour `#221811`, roughness 0.9
- face panel `[0.40, 0.13, 0.015]`, colour `#2C1F17`, roughness 0.85, proud 5 mm in Z
- brass handle: cylinder `r=0.008, len=0.12` rotated `[0, 0, PI/2]`, colour `#B8860B`,
  roughness 0.25, metalness 0.9 — plus two 5 mm pegs at `x = ±0.045`

These are the **only two hex literals outside the token palette** in the whole
room (walnut + brass). They are deliberate warm-wood exceptions. Do not add more.

---

## 5. Object inventory and placement (portfolio version)

| Object | position | role | interactive |
|---|---|---|---|
| Monitor 1 "primary" | `[-0.3, 0.306, -0.4]` | projects panel | yes |
| Monitor 2 "terminal" | `[0.5, 0.27, -0.4]` (0.5 × 0.3) | terminal panel | yes |
| Lamp | base `[-0.95, 0, -0.2]`, bulb `[-0.95, 0.35, -0.2]` | key light source | no |
| Keyboard | `[0, 0.011, 0.2]` | dressing | no |
| Mug | `[-0.55, 0, 0.15]` | dressing | no |
| Plant | `[-0.8, 0, 0.1]` | dressing | no |
| Notebook | `[-0.4, 0, 0.05]` | writing panel | yes |
| Headphones | `[0.85, 0.045, 0.15]` | audio toggle | yes |
| Phone | `[0.7, 0, -0.1]` | contact panel | yes |
| Window | `[1.98, 1.0, -0.3]`, rot `[0, -PI/2, 0]` | scene transition | yes |
| Door spill | invisible disc at `[-1.0, -0.73, 0.3]`, `circleGeometry(0.45, 24)` | scene transition | yes |

**The door is not geometry.** It is a warm patch of light on the floor at
camera-left plus a transparent hit disc. There is no door mesh. This is a
pattern worth keeping: *a light source off-frame implies a space off-frame.*

### Ambient population
- **Dust motes** — 25 points, `LAMP_WARM`, size 0.005, opacity 0.08,
  confined to the lamp cone `x ∈ [-1.1, -0.3]`, `y ∈ [-0.7, 0.35]`, `z ∈ [-0.5, 0.2]`.
  Slow upward drift — seeded `0.01–0.02` but applied as `speedY * dt * 1.5`, so effectively **0.015–0.03 m/s** + sine sway, wrap at `y > 0.35`.
  Frozen under `prefers-reduced-motion`.
- **Window rain** — 18 drops, plane `0.0018 × [0.015…0.04]`, `RAIN_STREAK`,
  opacity 0.3–0.6, falling 0.25–0.7 m/s, reset at the bottom frame.
  Removed entirely under `prefers-reduced-motion`.

---

## 6. The window as a state display

The window is the room's one **live surface**, and the pattern generalises
directly to a habit tracker. It is not a picture — it's two emissive planes
behind glass whose colour is driven by application state, lerped every frame.

- **Frame**: 4 boxes, thickness 0.04, depth 0.06, `BG_PANEL`, roughness 0.7,
  metalness 0.15, plus a centre mullion.
- **Glass**: `meshPhysicalMaterial`, `transmission 0.55`, roughness 0.12,
  `ior 1.45`, thickness 0.05, colour `BG_NIGHT`.
- **Sky plane** (upper, `[0, 0.25, -0.3]`, `0.644 × 0.55`) — tracks the
  coarse session state via a lookup table of `{ color, intensity }`.
- **City plane** (lower, `[0, -0.25, -0.3]`) — tracks direction: base
  `VOXEL_GLOW_SOFT`, lerped **only 5 %** toward `LAMP_WARM` (up) or
  `VOXEL_GLOW` (down).

**The 5 % rule is the design lesson.** State changes shift hue by a
barely-perceptible amount. You notice it after twenty minutes, not instantly.
Resist the urge to make state legible at a glance in the 3D layer — that's what
the DOM panels are for.

Both planes lerp at `k = 0.05` per frame (≈ 1 s to 95 % of target) and **snap**
instead under reduced motion. Reads state via `store.getState()` inside
`useFrame` — **no React subscription, no re-render per tick.**

---

## 7. Hard rules for anyone extending the room

1. `y = 0` is the desk top. Never re-datum to the floor.
2. New objects get their base at their group origin, or you document the offset.
3. Colours come from the token module. Two exceptions exist (walnut, brass) and
   they are already spent.
4. Everything that sits on the desk **casts** a shadow; the desk, floor and
   walls **receive** one. Only the lamp casts.
5. Ambient motion is always on, always slow, always killable by reduced motion.
6. Do not add a light. The rig is five roles / six light instances and it is
   balanced — see `05-lighting-rig.md`.
