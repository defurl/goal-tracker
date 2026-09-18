# 09 — Atmosphere Layers

> Four cheap layers sit on top of the geometry. Individually each is almost
> invisible. Together they are the difference between "a 3D scene" and "a room".
> Budget for all four.

---

## 1. Film grain (DOM, global)

A `::after` pseudo-element on a `.grain` wrapper covering the viewport:

```css
.grain::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>");
  opacity: 0.03;
  mix-blend-mode: overlay;
  z-index: 1000;
  animation: grain-drift 6s steps(6, end) infinite;
}
.grain[data-reduced-motion='true']::after { opacity: 0; animation: none; }
```

`steps(6, end)` over 6 s gives a 24 fps-coded stutter rather than a smooth
slide — it reads as film, not as a moving texture. **3 % opacity.** Inline SVG
turbulence means zero network cost.

Rule from the spec: *never use noise as a "design flourish" — only as
atmospheric depth.*

## 2. Bloom (WebGL post-pass)

See `05-lighting-rig.md` §5. Single pass, `intensity 0.9`,
`luminanceThreshold 0.1`, `mipmapBlur`. Disabled on reduced motion, on mobile,
and on sustained low FPS.

## 3. Dust motes (WebGL points)

25 points, `LAMP_WARM`, `size 0.005` with `sizeAttenuation`, **`opacity 0.08`**,
`depthWrite: false`, `toneMapped: false`. Confined to the lamp's cone. Slow
upward drift with a sine-wave horizontal sway and a soft radial pull back
toward the lamp centre when a mote strays past 1.0 m.

The opacity is the whole trick. At 0.08 you do not see dust; you see the light
having volume.

## 4. Weather on glass (WebGL planes)

18 thin planes (`0.0018` wide) in `RAIN_STREAK` at 30–60 % opacity, falling
0.25–0.7 m/s down the inside of the window, recycling at the bottom frame with
a fresh random X and speed. **Never global** — rain exists only on the pane.

Upgrade path noted in the source project: replace the line meshes with a glass
shader computing refraction and trickling droplets.

---

## Performance gates

All four layers are conditional. The scene must still read correctly with every
one of them off.

```ts
const lowFps = useAdaptiveFps(50, 2000);
if (reduced || lowFps || isMobile) return null;   // bloom
```

`useAdaptiveFps(threshold, sustainedMs)` keeps a 30-sample rolling FPS average
and flips a boolean only after the average stays below `threshold` for
`sustainedMs` continuously. It has **hysteresis**: once low, it will not flip
back until the average exceeds `threshold + 5`. Without the hysteresis, bloom
oscillates on and off right at the boundary, which is far worse than either
state.

Copy this hook. It is 30 lines and it is the reason the scene degrades
gracefully instead of stuttering.
