# 05 — The Lighting Rig

> **Five roles, six light instances** (the fill is a matched pair). That is the
> whole rig. It is balanced against a written acceptance test (§4). Adding
> another light is the fastest way to lose the look.

The authoritative visual is `references/lighting-plan.svg` — a top-down plan
with coordinates, intensities and a colour key. Open it. The values below are
the *revision-tuned* values actually shipped, which differ from the plan in
three places (noted inline) because the plan's values failed the acceptance test.

---

## 1. The sources

### KEY — desk lamp (`pointLight`)
```
position   [-0.95, 0.35, -0.2]     ← must equal the bulb mesh position
color      LAMP_WARM   #FFB661
intensity  8.0
distance   2.8                      ← plan said 2.0; see note
decay      2
castShadow true · shadow-mapSize [1024, 1024] · shadow-bias -0.0005
```
**The only shadow-caster in the scene.** One shadow source keeps contact
shadows readable and the GPU cost flat.

*Tuning note:* distance was raised `2.0 → 2.8` so the outer falloff reaches the
keyboard zone at roughly 20 % brightness. At 2.0 the falloff was too steep and
the keyboard fell outside the pool entirely, failing acceptance criterion 4.

### FILL ×2 — monitor glow (`spotLight`)
```
positions  [-0.3, 0.55, -0.4]  and  [0.5, 0.55, -0.4]
targets    [-0.3, 0.04, 0.2]   and  [0.5, 0.04, 0.2]     ← keyboard zone
color      VOXEL_GLOW  #5BC8FF
intensity  3.2 each
distance   1.5
decay      2
angle      0.6        (~34° cone)
penumbra   0.7        (soft edge)
```
*Tuning note:* these were `pointLight`s in the plan. Point lights at these
positions produced two bright circular cyan puddles directly under each monitor
— they read as discrete spotlights, not screen glow. Switching to spot lights
**aimed at the keyboard** puts the cool fill on the *front faces* of objects,
which is where screen glow actually lands. This is a generalisable fix: screen
glow is directional, not radial.

Each spot light needs a persistent `Object3D` as its `.target`, created once in
a `useMemo` and mounted with `<primitive object={target} />`.

### RIM — window (`directionalLight`)
```
position   [1.4, 1.0, -0.6]        ← direction is FROM here TOWARD the target
target     [0, 0.5, 0]
color      VOXEL_GLOW_SOFT  #2A6B8A
intensity  1.2
```
Gives the right-hand edges of objects a cool separation edge against the dark
back wall. Also needs an `Object3D` target.

### DOOR SPILL — off-frame warm (`pointLight`)
```
position   [-1.8, 0.4, 0.5]        ← plan said z = +1.0; see note
color      LAMP_WARM  #FFB661
intensity  3.5                      ← plan said 2.4
distance   2.5
decay      2
```
No geometry. This light *is* the doorway. It lays a warm rectangle on the floor
at camera-left, implying a lit hallway outside the frame.

*Tuning note:* at `z = +1.0` the spill's floor pool sat adjacent to the lamp's
own floor pool and the two warm sources merged into one indistinct patch.
Pulling it to `z = +0.5` lands it *forward* of the lamp's reach so it reads as a
distinct second origin. The intensity bump compensates for the steeper angle of
incidence.

### AMBIENT (`ambientLight`)
```
color      BG_NIGHT  #0A0F1A
intensity  0.15
```
Barely there. Its job is only to keep the darkest surfaces from crushing to
pure black. It is tinted with the background colour, not white — that is what
keeps the shadows navy rather than grey.

---

## 2. Intensity ratios

Relative to KEY = 1.0. If you rescale the rig for a different room size, keep
these ratios, not the absolute numbers.

| Source | ratio | intensity |
|---|---|---|
| KEY (lamp) | 1.00 | 8.0 |
| FILL (monitor 1) | 0.40 | 3.2 |
| FILL (monitor 2) | 0.40 | 3.2 |
| DOOR SPILL | 0.44 | 3.5 |
| RIM (window) | 0.15 | 1.2 |
| AMBIENT | 0.02 | 0.15 |

---

## 3. Colour-temperature zoning

Read the frame left-to-right as a temperature gradient. This is deliberate and
it is the reason the room looks composed rather than lit.

```
 camera-left  ──────────────────────────────────────────►  camera-right
 door spill │ lamp pool │ monitor 1 │ centre │ monitor 2 │ window rim │ city
   WARM     │   WARM    │ warm tint │  dim   │   cool    │    COOL    │ COOL
```

The rule from the design spec: **the desk scene leans warm; the city leans
cool; the neutral scene leans paper.** Within the desk, warmth decreases
left-to-right. Any new emissive object must pick a side.

---

## 4. Acceptance test

All five must read TRUE in a lighting-only screenshot before the rig is signed
off. Re-run this whenever you move a light.

- [ ] The lamp pool is visibly the brightest area in frame
- [ ] The right edge of the scene reads measurably cooler than the left
- [ ] A warm rectangle of light is visible on the floor at camera-left
- [ ] The keyboard area sits in the lamp's outer falloff (~20 % brightness)
- [ ] No object is pure black; no object is fully lit by ambient flood

---

## 5. Post-processing

Single broad bloom pass (`@react-three/postprocessing`):
```
intensity           0.9
luminanceThreshold  0.1
luminanceSmoothing  0.4
mipmapBlur          true
```

The threshold is low (0.1) on purpose — it has to catch three very different
luminances: the lamp bulb (`MeshBasicMaterial`, `toneMapped: false`, ~0.55),
monitor 1's emissive (`SIGNAL_AMBER_DIM × 1.2`, ~0.12) and monitor 2's
(`VOXEL_GLOW_SOFT × 1.0`, ~0.13).

**Bloom is disabled entirely when any of these is true:**
- `prefers-reduced-motion` is set
- the adaptive-FPS detector reports sustained low frame rate
- the viewport is mobile

These are intentional perf escape hatches, not bugs. The scene must still read
correctly with no bloom at all.

> The design spec asks for *different* bloom on warm vs cool sources
> ("bloom on warm lamp light, cooler bloom on monitor glow — they should not
> match"). The shipped implementation uses one broad pass as a compromise.
> If the new project has budget, a selective two-pass bloom is the upgrade.
