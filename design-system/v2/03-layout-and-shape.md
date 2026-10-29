# 03 — Layout and shape

From the UI/UX specification §3-4, with the owner's direction of D-26 §10:
smaller radii, no gradients. **PROPOSED** unless a decision is cited.

## Grid

- 1440 px baseline; content up to 1360 px wide; 32-48 px side margins; 12
  columns; 16-20 px gaps.
- Desktop, 1200 px and up: two or three meaningful columns. Tablet: two
  columns or stacked. Phone, below 768 px: one column, content first, a still of
  the room as a hero, compact menu. Nothing on a phone depends on the 3D room.
- Spacing steps: 4, 8, 12, 16, 20, 24, 32, 48.

## Shell

- **Overview:** the user's editable space title and its subtitle centred at
  the top, the menu centred beneath, profile and settings top right.
- **Focused:** Home (back to the room) on the left, the menu in the centre, the
  avatar on the right. Search and notifications are later items.
- A board's content scrolls in its own layer. The camera never scrolls with it.

## Cards

- `--surface` at 88-95% opacity (92% proposed), so text contrast never depends
  on what is behind the card (D-04's amendment).
- 1 px `--line` border, radius 12 px, one soft shadow, padding 20 px (16 px on
  phones).
- One title row pattern everywhere: an optional line icon, the heading, and at
  most one text action on the right ("See all", "Edit").
- Same padding, type and status patterns in every module (UI/UX §4).

## Radius

| radius | used for |
|---|---|
| 4 px | tags and chips |
| 8 px | buttons, inputs, menu items, the menu bar |
| 12 px | cards and board panels |

Nothing rounder (D-26 §10). No pill-shaped buttons.

## Controls

- 40-44 px tall; touch targets at least 44 px on phones.
- **Primary:** filled `--interactive`, `--surface` text.
- **Secondary:** 1 px `--ink-faint` outline, `--ink` text.
- **Tertiary:** text only, `--interactive-ink`.
- **Focus:** a 2 px `--interactive` ring with a 2 px offset, on every control,
  equivalent to hover (UI/UX §4).
- **Inputs:** `--surface` fill, 1 px `--ink-faint` border (3.17 : 1), 8 px
  radius, label above, help or error text below. An error is stated in words
  with an icon, in `--ink`. There is no red.

## Surface effects

- One shadow per card, tinted with `--ink`, low opacity. Exact values set in P1.
- No gradients (D-26 §10).
- A backdrop blur is allowed on the menu bar as polish. Legibility never
  depends on it.
