# 02 — Typography

> No Inter. No Roboto. No system-ui. The type choices are part of the signal.

## The three faces

| role | family | source | weights | usage |
|---|---|---|---|---|
| display | **Fraunces** | Google Fonts / `@fontsource/fraunces` | 400 italic, 500, 600 | scene titles, section headers, the rare large statement. Italic at display sizes for the editorial feel. Axes `SOFT: 50`, `WONK: 1`. |
| body | **Geist** | Vercel / `@fontsource/geist-sans` | 400, 500 | all body copy, UI text, button labels |
| mono | **Departure Mono** | https://departuremono.com (free) | 400 | terminal text, ticker text, data labels, timestamps, **any numeric value**. Fallback `JetBrains Mono`. |

Departure Mono is self-hosted — drop the `.woff2` into `public/fonts/` and
declare it with an `@font-face` using `font-display: swap`. The other two come
from `@fontsource` packages imported in the global stylesheet.

```css
--font-display: 'Fraunces', Georgia, serif;
--font-body:    'Geist', -apple-system, sans-serif;
--font-mono:    'Departure Mono', 'JetBrains Mono', ui-monospace, monospace;
```

**Departure Mono is non-negotiable for anything in-world.** The floating hover
labels above 3D objects use it, lowercase, wide-tracked. That one choice does
more for the room's character than any other type decision.

---

## Scale

| step | desktop | mobile (≤768 px) |
|---|---|---|
| `--step-1` | 0.75rem | 0.7rem |
| `--step-0` | 0.875rem | 0.8rem |
| `--step-1-up` | 1rem | 0.875rem |
| `--step-2` | 1.25rem | 1rem |
| `--step-3` | 1.5rem | 1.25rem |
| `--step-4` | 2rem | 1.5rem |
| `--step-5` | 3rem | 2rem |
| `--step-6` | 4.5rem | 3rem |
| `--step-7` | 6.5rem | 4.5rem |

Mobile steps **every rung down by one**. Components keep referencing
`var(--step-N)`; the values shift underneath them. No component-level media
queries for type.

---

## Rules

1. Headings use **Fraunces italic** at `step-5` or `step-6`. They appear
   sparingly and should feel like quiet announcements, not banners.
2. Body is **Geist** at `step-0` or `step-1-up`. Line height **1.6 for prose,
   1.4 for UI** (1.5 body on mobile).
3. **All numeric data is mono. All terminal/log content is mono.**
4. `font-variant-numeric: tabular-nums` globally — set on `html, body, #root`.
   Non-negotiable for streak counts, dates and any column of numbers.
5. Letter-spacing is `0` by default. Wide tracking (`0.14em`) only on small-caps
   or lowercase mono labels — e.g. the in-world hover label.
6. `-webkit-font-smoothing: antialiased`, `text-rendering: optimizeLegibility`.

---

## The in-world label

The single most reused type treatment. Copy it verbatim:

```css
.label {
  font-family: var(--font-mono);
  font-size: var(--step-1);
  letter-spacing: 0.14em;
  text-transform: lowercase;
  color: var(--signal-amber);
  background: rgba(10, 15, 26, 0.78);   /* --bg-night at 78% */
  border: 1px solid var(--ink-ghost);
  padding: 0.25rem 0.55rem;
  white-space: nowrap;
  user-select: none;
}
```

Lowercase, amber, mono, wide-tracked, on a translucent night-tinted plate with
a ghost border. No rounded corners. No blur. It reads as a terminal annotation
floating in a physical space, which is exactly the register the room wants.
