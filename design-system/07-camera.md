# 07 — Camera

> The camera never free-orbits in the room. It sits at one rest pose and glides
> to named framings. This is a deliberate constraint: it means every object can
> be lit and composed for a known set of viewpoints.

---

## 1. Canvas setup

```tsx
<Canvas
  camera={{ position: [0, 1.15, 2.2], fov: 50 }}
  onCreated={({ camera }) => camera.lookAt(0, 0.4, 0)}
  dpr={[1, 2]}                                   // capped at 2 even on retina
  gl={{ antialias: true, powerPreference: 'high-performance' }}
  shadows
  style={{ position: 'fixed', inset: 0, background: 'var(--bg-void)' }}
/>
```

**Mobile** swaps to `position: [0, 1.6, 2.4], fov: 38` with `lookAt(0, -0.05, -0.1)`
— raised, tilted further down, FOV tightened. This frames more of the desk as a
near-orthographic overview so all objects fit without scrolling.

---

## 2. Poses

A pose is `{ position, target }`. Both are world-space; the rig tracks the
lookAt point itself because Three.js cameras do not store one.

```ts
REST_POSE        = { position: [0, 1.15, 2.2], target: [0, 0.4, 0] }
REST_POSE_MOBILE = { position: [0, 1.6, 2.4],  target: [0, -0.05, -0.1] }
```

Focus poses, for reference (each object gets one):

| id | position | target |
|---|---|---|
| monitor1 | `[-0.5, 0.42, 0.25]` | `[-0.32, 0.34, -0.4]` |
| monitor2 | `[0.28, 0.4, 0.25]` | `[0.5, 0.32, -0.4]` |
| notebook | `[-0.55, 0.5, 0.45]` | `[-0.4, 0.0, 0.05]` |
| headphones | `[0.6, 0.42, 0.6]` | `[0.85, 0.04, 0.15]` |
| phone | `[0.5, 0.42, 0.45]` | `[0.7, 0.05, -0.1]` |
| window | `[0.4, 0.9, 0.9]` | `[1.98, 1.0, -0.3]` |
| door | `[-0.4, 0.7, 1.2]` | `[-1.4, -0.74, 0.3]` |

**Composition rule baked into every focus pose: the focused object sits
LEFT of centre**, because the DOM detail panel slides in from the right at
~480 px and would otherwise occlude it. If your panel comes from a different
edge, mirror the bias.

---

## 3. The glide

Hand-rolled, no animation library. On `focus` change the rig lerps position and
lookAt from *current* to *target* over `GLIDE_MS = 2200` (matches the
`--dur-camera` token), then pins.

```ts
function easeInOutCubic(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
}
```

`easeInOutCubic` is a solver-free stand-in for the spec's
`cubic-bezier(0.65, 0, 0.35, 1)`. Close enough at this duration; use the real
bezier only if you need exact parity with a CSS transition.

Mechanics worth copying:
- `fromPos` / `fromTarget` are captured from the **live camera** at the moment
  focus changes, so interrupting a glide mid-flight blends smoothly rather than
  snapping to the old origin.
- Under `prefers-reduced-motion`, `elapsed` is initialised to `GLIDE_MS` — the
  glide completes on frame 1. The DOM panel still crossfades, so the transition
  is still legible, just not spatial.
- After settling, the rig keeps re-pinning position and lookAt each frame to
  absorb any drift.
- The rig renders `null`. It is a pure `useFrame` side-effect component.

---

## 4. Why no orbit controls

Free orbit was rejected for three reasons that still apply:

1. The room has no left wall, no ceiling and no front wall. Orbiting reveals
   the void.
2. The lighting rig is composed for a frontal view. The colour-temperature
   left-to-right gradient only exists from the rest pose.
3. Focus poses are hand-tuned against the 480 px panel. Arbitrary camera angles
   break that composition.

If the new project needs the user to look around (likely, if a task tree grows
somewhere off-desk), the cheapest safe option is a **constrained orbit**: a
small yaw/pitch range around the rest pose with damping, clamped so the missing
walls never enter frame. Build the walls before you unlock the camera.
