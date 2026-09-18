# Self-hosted fonts

## Departure Mono — required, not vendored

`Departure Mono` is the mono face for the whole product and it is
**non-negotiable for anything in-world** (design-system/02-typography.md, D-02):
the floating hover labels above 3D objects are lowercase, wide-tracked Departure
Mono, and that single treatment does more for the room's character than any
other type decision.

It is free but not on npm, so it is not installed by `pnpm install`.

1. Download it from <https://departuremono.com>.
2. Drop `DepartureMono-Regular.woff2` into this directory.

`styles/globals.css` already declares the `@font-face` with `font-display: swap`,
and `--font-mono` falls back to `JetBrains Mono` then `ui-monospace`, so the
build is never blocked on the file being absent — but the type will be wrong
until it is here.

Fraunces and Geist need nothing: they come from the `@fontsource` packages and
are imported in `app/layout.tsx`.
