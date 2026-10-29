# 02 — Type

**LOCKED by D-26 §10** (D-02 amended): Inter for body and UI text, an upright
serif for display, no italic headings, normal letter-spacing. The scale below
follows the UI/UX specification §3 and is **PROPOSED** inside its ranges.

| role | family | size, px (spec range) | weight | line height | letter-spacing |
|---|---|---|---|---|---|
| H1, display | serif (design team; Georgia fallback) | 36 (32-40) | 500 | 1.15 | -0.01em |
| H2 | serif | 24 (22-26) | 500 | 1.2 | 0 |
| Card heading | Inter | 18 (16-19) | 600 | 1.3 | 0 |
| Body | Inter | 16 (14-16) | 400 | 1.5 | 0 |
| Small, meta | Inter | 14 | 400 or 500 | 1.45 | 0 |
| Caption | Inter | 12-13 | 400 or 500 | 1.4 | 0 |

Proposed scale tokens, replacing the night room's `--step-*` values in P1:
caption `0.75rem`, small `0.875rem`, body `1rem`, card `1.125rem`, H2
`1.5rem`, H1 `2.25rem`. Below 768 px everything above body steps down one rung.

## Rules

1. Numbers that line up are tabular (`font-variant-numeric: tabular-nums`).
2. No italic headings. Italic appears, if at all, inside running text for the
   title of a book, video or article.
3. No all-caps label rows. A label that must be capitals gets at most +0.02em.
4. Nothing smaller than 12 px; the auth pages hold 12 px on phones (D-22 §4).
5. Fonts are self-hosted, as today's are, so no font request leaves the app at
   runtime. Inter is available as an `@fontsource` package.
6. Handwriting, like the sticky notes in `dashboard.jpg`, belongs to the room's
   art, never to interface text. **PROPOSED.**

## Open

- The display serif: the design team names it and confirms its licence. Until
  then Georgia stands in.
