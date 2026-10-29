# 01 — Colour

Tokens are named by role (D-21). Values come from the UI/UX specification §3,
with two darkened so small text clears 4.5 : 1 (D-22 §3). The three mirrors
(`styles/tokens.css`, `lib/style/colors.ts`, `design-spec.jsonc`) and
`lint:colors` move to these values in P1. Until then they hold the night
palette.

Contrast ratios are WCAG relative-luminance ratios, computed from the hex
values.

| token | value | source | on `--canvas` / `--surface` | use |
|---|---|---|---|---|
| `--canvas` | `#F7F0E5` | spec "warm ivory" | — | page background; the tint over a blurred room |
| `--surface` | `#FFF9EF` | spec "parchment" | — | cards, the menu bar, inputs |
| `--ink` | `#26392F` | spec "dark botanical" | 10.86 / 11.73 | headings and body |
| `--ink-muted` | `#5F6C63` | spec `#647168`, darkened | 4.87 / 5.26 | secondary text that says something |
| `--ink-faint` | `#7F8A82` | new | 3.17 / 3.42 | input borders (non-text, 3 : 1), disabled text, decoration. Never informative text |
| `--line` | `#E4D9C6` | new, for the spec's "1 px warm border" | 1.23 / 1.33 | decorative card borders and dividers only |
| `--interactive` | `#587660` | spec "interactive sage" | 4.44 / 4.80 | filled buttons, icons, the focus ring, large text (24 px, or 18.66 px bold) |
| `--interactive-ink` | `#557259` | spec sage, darkened | 4.71 / 5.09 | small sage text: links and text buttons |
| `--signal` | `#D6AA75` | spec "accent honey" | 1.88 / 2.03 | fills, markers, selected states, highlights. **Never text.** `--ink` on it is 5.77 |

## Rules

1. No colour outside this table in the interface. The room's baked textures and
   the shop items' textures are art, not tokens, and sit outside `lint:colors`.
2. Text that says something is at least 4.5 : 1 against what it sits on (D-22
   §3). Cards are `--surface` at 88-95% opacity, so check text on `--surface`
   and over the darkest anchor's blurred still.
3. Text on a filled `--interactive` button is `--surface` (4.80 : 1).
4. No gradients anywhere (D-26 §10).
5. Colour never carries meaning alone (UI/UX §4). A mood, a completion or a
   selected state also has a shape, an icon or a word.
6. Nothing in the palette judges the user. A missed day, a skip and a purchase
   use the same colours as anything neutral. There is no red.

## Retired with the night room (P1)

`--bg-void`, `--bg-night`, `--bg-panel`, `--bg-panel-2`, `--ink-paper`,
`--ink-ghost`, `--signal-hot`, `--signal-dim`, `--glow-cool`,
`--glow-cool-soft`, `--lamp-warm`, `--rain-streak`, `--data-green`,
`--data-red`, `--data-neutral`. If a v2 component turns out to need one, it
comes back with a value checked against this table.

## Open

- Tints for chips and tags. `dashboard.jpg` shows peach, sage and lavender;
  the design team picks them, and each is checked with `--ink` on top.
- A darker honey for text, if a component needs honey-coloured words. None
  does yet.
