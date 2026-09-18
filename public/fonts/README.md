# Self-hosted fonts

## Departure Mono — vendored

`Departure Mono` is the mono face for the whole product and it is
**non-negotiable for anything in-world** (design-system/02-typography.md, D-02):
the floating hover labels above 3D objects are lowercase, wide-tracked Departure
Mono, and that single treatment does more for the room's character than any
other type decision.

It is free but not on npm, so `pnpm install` does not fetch it. It is committed
here instead:

- `DepartureMono-Regular.woff2` — the only weight the product uses.
- `DepartureMono-LICENSE.txt` — SIL Open Font License 1.1, which requires the
  licence to travel with the font. Do not delete it.

Upstream is <https://departuremono.com> (v1.500). The download also ships an
`.otf` and a `.woff`; neither is referenced, and everything under `public/` is
served to clients, so they are deliberately not vendored.

`styles/globals.css` declares the `@font-face` with `font-display: swap`, and
`--font-mono` falls back to `JetBrains Mono` then `ui-monospace`, so the build
is never blocked on the file — but the type is wrong without it.

Fraunces and Geist need nothing: they come from the `@fontsource` packages and
are imported in `app/layout.tsx`.
