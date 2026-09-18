# 01 — Colour Palette

> **Superseded for BBE by `../spec/01-decisions.md` D-21 (2026-09-18).**
> This document and `tokens/` record the palette as extracted from the
> portfolio. BBE's live palette is `styles/tokens.css`, `lib/style/colors.ts`
> and `design-spec.jsonc` at the repository root: the accent is a dusty rose
> rather than terminal amber, `--ink-paper` is near-white, the cyan is
> desaturated, and the accent tokens are named by role (`--signal`, not
> `--signal-amber`). The rules below still hold — only the values and the
> token names moved. `--lamp-warm` is unchanged.
>
> Canonical values live in `tokens/colors.ts` (TypeScript), `tokens/tokens.css`
> (CSS custom properties) and `tokens/design-spec.jsonc` (the contract).
> **Three mirrors of one palette — change one, change all three.**
> A colour lint enforces it in CI. Carry that lint over.

---

## Tokens

### Backgrounds
| token | hex | role |
|---|---|---|
| `--bg-void` | `#05070D` | deepest background, near-black; canvas clear colour |
| `--bg-night` | `#0A0F1A` | primary background, dim navy; ambient light tint |
| `--bg-panel` | `#121826` | raised surfaces — panels, desk, floor, walls, monitor frames |
| `--bg-panel-2` | `#1A2230` | hovered / active surfaces, monitor bezels, plant pot |

### Ink
| token | hex | role |
|---|---|---|
| `--ink-paper` | `#EDE6D3` | primary text — warm off-white, **paper-toned, not cool white** |
| `--ink-muted` | `#9BA3B4` | secondary text |
| `--ink-faint` | `#5A6275` | tertiary text, captions |
| `--ink-ghost` | `#2E3340` | borders, dividers, dark metal, wall joints |

### Signal
| token | hex | role |
|---|---|---|
| `--signal-amber` | `#FFA630` | **the soul colour.** Primary accent, hover labels, focus rings, links |
| `--signal-amber-hot` | `#FFD27A` | amber highlight / hover |
| `--signal-amber-dim` | `#7A4F18` | amber faded / disabled; primary monitor's emissive tint |

### Data
| token | hex | role |
|---|---|---|
| `--data-green` | `#4ADE80` | live-data positive, CRT-coded |
| `--data-red` | `#F87171` | live-data negative — muted, not screaming |
| `--data-neutral` | `#9BA3B4` | flat / neutral |

### Environment
| token | hex | role |
|---|---|---|
| `--voxel-glow` | `#5BC8FF` | the cyan that makes the world look alive; monitor fill lights |
| `--voxel-glow-soft` | `#2A6B8A` | ambient sky bounce; window rim light; secondary screen emissive |
| `--lamp-warm` | `#FFB661` | the desk lamp — the only truly warm light source |
| `--rain-streak` | `#3A4555` | rain on the window |

---

## Rules

1. **Background is always dark.** There is no light mode and the portfolio was
   not building one. *(The habit tracker may want to revisit this — see
   `00-aesthetic-thesis.md` and `12-habit-tracker-adaptation.md` §6.)*
2. **Amber is the only colour that ever occupies >40 % of an area.** Everything
   else is accent or signal.
3. **Green and red are reserved for live data** — never for UI affordances like
   success/error states. A saved form does not turn green.
4. **Warm/cool zoning is spatial:** the desk leans warm (amber + lamp), the
   outdoors leans cool (cyan), neutral spaces lean paper.
5. **Never use pure white `#FFFFFF`.** Paper tone only.
6. **Never use a gradient containing purple, indigo or pink.**

---

## Contrast targets

- paper text on `--bg-night` ≥ **7:1**
- amber on `--bg-night` ≥ **4.5:1**
- focus ring: 2 px solid `--signal-amber`, offset 2 px, always visible

---

## Deriving new colours

Do not add hex literals. Derive from a token at runtime:

```ts
const mutedLeaf = new Color(DATA_GREEN).multiplyScalar(0.35);
const cityUp    = new Color(VOXEL_GLOW_SOFT).lerp(new Color(LAMP_WARM), 0.05);
```

The portfolio's only sanctioned literals are the drawer walnut (`#221811`,
`#2C1F17`) and the brass handle (`#B8860B`). If the habit tracker adds a wood
or plant palette for the task tree, extend the **token file**, do not scatter
literals, and add the new tokens to all three mirrors.
