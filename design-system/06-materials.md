# 06 — Material Grammar

> Every surface in the room is a `meshStandardMaterial` except four named
> exceptions. There are no textures on the desk scene — the look comes from
> **roughness/metalness discipline plus a single warm key light**, not maps.

---

## 1. The material table

| Surface class | colour | roughness | metalness | notes |
|---|---|---|---|---|
| Desk top, floor, all walls | `BG_PANEL` `#121826` | 0.85 | 0.05 | matte, receives shadow |
| Desk legs | `INK_GHOST` `#2E3340` | 0.40 | 0.70 | dark metal |
| Lamp base + arm | `BG_PANEL` `#121826` | 0.60 | 0.70 | brushed metal |
| Lamp shade, outside | `BG_PANEL` `#121826` | 0.60 | 0.70 | `side: DoubleSide` (`side={2}`) |
| Lamp shade, inside | `BG_PANEL_2` + emissive `LAMP_WARM` @ 0.4 | 0.55 | 0.10 | **`side: BackSide`** (`side={1}`) — the inner dome is only visible from below through the open rim, so FrontSide would render it invisible from the room |
| Lamp bulb | `LAMP_WARM` | — | — | **`meshBasicMaterial`**, `toneMapped: false`, bloom target |
| Monitor bezel | `BG_PANEL_2` `#1A2230` | 0.55 | 0.35 | casts shadow |
| Monitor screen (primary) | `BG_VOID` + emissive `SIGNAL_AMBER_DIM` @ 1.2 | 0.90 | 0.05 | `toneMapped: false`, bloom target |
| Monitor screen (secondary) | `BG_VOID` + emissive `VOXEL_GLOW_SOFT` @ 1.0 | 0.90 | 0.05 | `toneMapped: false`, bloom target |
| Monitor stand + foot | `INK_GHOST` | 0.5–0.6 | 0.5–0.55 | |
| Window frame + mullion | `BG_PANEL` | 0.70 | 0.15 | |
| Window glass | `BG_NIGHT` | 0.12 | 0.05 | **`meshPhysicalMaterial`**, `transmission 0.55`, `ior 1.45`, `thickness 0.05` |
| Wall joints | `INK_GHOST` | 1.00 | 0.00 | fully matte |
| Tie-rod holes | `BG_VOID` | 1.00 | 0.00 | reads as depth |
| Plant pot | `BG_PANEL_2` | 0.90 | 0.05 | |
| Plant leaves | `DATA_GREEN × 0.35` | 0.90 | 0.00 | `side: DoubleSide` |
| Drawer body | `#221811` walnut | 0.90 | 0.05 | sanctioned exception |
| Drawer face | `#2C1F17` walnut | 0.85 | 0.05 | sanctioned exception |
| Drawer handle | `#B8860B` brass | 0.25 | 0.90 | sanctioned exception |
| Mug body / handle | `BG_VOID` | 0.35 / 0.40 | 0.15 | highlight catcher |
| Phone body | `BG_VOID` | 0.25 | **0.50** | reads as metal, not plastic |
| Phone camera bump | `INK_GHOST` | 0.30 | 0.65 | |
| Phone screen | `BG_VOID` | 0.90 | 0.00 | matte, off |
| Headphone cups | `BG_VOID` | 0.50 | 0.20 | |
| Headphone band | `INK_GHOST` | 0.40 | 0.60 | metal |
| Headphone pads | `INK_FAINT` | 0.95 | 0.00 | `side: DoubleSide` |
| Notebook / soft goods | token colours | 0.90 | 0.00 | matte |

---

## 2. The three roughness bands

Almost every material in the room falls into one of three bands. Pick a band
before you pick a number.

- **Matte (0.85 – 1.0, metalness 0–0.05)** — architecture and paper. Floor,
  walls, desk top, notebook, plant pot, joints. These absorb the lamp and
  produce the soft falloff that defines the room.
- **Metal (0.4 – 0.7, metalness 0.5 – 0.9)** — hardware. Legs, lamp body,
  monitor stands, brass. These catch a specular highlight from the lamp and are
  what stop the scene reading as felt.
- **Highlight catchers (0.25 – 0.5, metalness 0.15 – 0.2)** — ceramics and soft
  goods: the mug (0.35 / 0.15), the headphone cups (0.5 / 0.2). One crisp
  highlight each, no more.

  Note that the phone body (0.25 / 0.5) and the headphone band (0.4 / 0.6) sit
  in the **metal** band, not this one, despite being small props. Read the
  table rather than guessing from the object's real-world material.

---

## 3. Emissive rules

1. An emissive surface always has a **dark base `color`** (`BG_VOID` or
   `BG_NIGHT`). The emissive layer is what glows; the base keeps it from
   washing out when unlit.
2. Any surface intended for bloom sets **`toneMapped: false`** so the raw
   luminance survives to the bloom pass.
3. Emissive intensity lives in the range **0.4 – 1.4**. Above that, bloom
   smears.
4. Screens use a `GradientTexture` on `emissiveMap` (`INK_PAPER → INK_MUTED →
   INK_FAINT`, stops `[0, 0.5, 1]`) so the glow falls off toward the bottom of
   the panel instead of reading as a flat rectangle. **This single trick is what
   makes the monitors look like screens rather than lit planes.**
5. Hover lifts emissive intensity by **×1.2**, applied as an instant value swap
   — no easing frame loop, so it still "appears" under reduced motion.

---

## 4. Palette discipline

The project ships a colour lint (`scripts/lint-colors.mjs`, run as
`pnpm lint:colors`, enforced in CI) that fails the build on any hex literal
outside the token set. Carry this over. It is the reason the room stayed
coherent across five phases of work.

When you need a variant of a token — say a muted plant green — **derive it at
runtime** rather than introducing a literal:

```ts
const leafColor = useMemo(() => new Color(DATA_GREEN).multiplyScalar(0.35), []);
```

Only the walnut and brass literals are exempt, and they are documented as
exemptions in the source.

---

## 5. Shadow policy

- `castShadow`: every object on the desk, desk top, desk legs, drawer boxes,
  monitor bezels/stands, lamp parts, window frame, plant.
- `receiveShadow`: desk top, floor, all wall segments.
- **One shadow-casting light only** (the lamp), 1024×1024 map, bias `-0.0005`.

Screens, bulbs, dust motes, rain drops and the invisible hit disc cast nothing.

---

## 6. Known upgrade path

The room is built entirely from primitives (box, cylinder, sphere, plane) with
untextured standard materials. The project's own visual-upgrade analysis
identified three ways forward, in the order they were recommended:

1. **Depth of field** post-pass focused on the active object — cheapest path to
   a photographic feel, fully compatible with the current geometry.
2. **Normal + roughness maps** on concrete and wood. The portfolio already
   carries `Concrete033_2K` normal and roughness JPGs in `public/textures/concrete/`
   for the neutral scene; the same treatment applies to the room walls.
3. **SSAO** to darken contact points (mug on desk, pot on desk) and ground
   objects.

A fourth option — baking the whole room in Blender and compositing transparent
hit-boxes over a still — was considered and is viable *only* because the camera
is near-fixed. It trades all camera freedom for photorealism. For a habit
tracker with a task tree that grows, this trade is probably wrong.
