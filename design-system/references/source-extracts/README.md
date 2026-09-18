# Source extracts — REFERENCE ONLY

Verbatim copies of the room's source files from `D:\CODE\portfolio`
(`src/scenes/desk/`, `src/lib/`, `src/styles/`), taken 2026-09-17.

**These are not a starter kit.** They are here so that when a spec in
`design-system/*.md` is ambiguous, you can read the exact numbers and the
inline comments that explain why each value is what it is. The code was tuned
for a portfolio, carries portfolio-specific naming (`Desk*`, market-data
bindings in `Window.tsx`), and has not been optimised or generalised.

Re-implement against the specs. Consult these when in doubt. Do not copy
wholesale.

## Where the real value is

- **`lighting.ts`** — every light value with a comment explaining the deviation
  from the plan. Read this one properly.
- **`CameraRig.tsx`** — the interruptible glide. ~50 lines, no dependencies.
- **`InteractiveObject.tsx`** — hover + mobile arm-tap + keyboard focus in one
  wrapper. Directly portable.
- **`useAdaptiveFps.ts`** — rolling FPS average with hysteresis. Directly portable.
- **`objects/AndoWallDetails.tsx`** — the concrete joint and tie-rod grid. This
  is what makes the walls look like architecture.
- **`objects/Window.tsx`** — the state-to-emissive lerp pattern, including the
  `getState()`-inside-`useFrame` approach. Ignore the market bindings; keep the
  mechanism.
- **`objects/Monitor.tsx`** — the `GradientTexture` on `emissiveMap` trick that
  makes a plane read as a screen.
