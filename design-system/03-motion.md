# 03 — Motion

> Motion here is slow, atmospheric and rare. We are not building a sales page.
> We are building a place.

## Principles

1. **Slow over fast.** Default ease-out duration is 600–900 ms for most UI motion.
2. **Camera moves are 1.5–3 s** with eased cinematic curves — think interior
   reveal, not page transition.
3. **Ambient motion is always present in 3D scenes** — breathing, swaying,
   drifting. Never a static frame.
4. **Sharp, sub-second motion is reserved for live-data events** — a tick, a
   completion, a deploy. Its rarity is what makes it register.
5. **Respect `prefers-reduced-motion` absolutely.** Replace camera moves with
   crossfades, kill ambient drift, freeze breathing. Not "reduce" — remove.

---

## Tokens

```css
--ease-ui:     cubic-bezier(0.22, 1, 0.36, 1);
--ease-camera: cubic-bezier(0.65, 0, 0.35, 1);
--ease-data:   cubic-bezier(0.4, 0, 0.2, 1);

--dur-instant: 80ms;
--dur-tick:    180ms;
--dur-ui:      600ms;
--dur-reveal:  900ms;
--dur-camera:  2200ms;
--dur-scene:   3000ms;
```

Ambient breathing is not a token — it is a sine wave with a **4–8 s period**,
ease-in-out by nature.

In 3D code, `--dur-camera` appears as the literal `GLIDE_MS = 2200`, and
`cubic-bezier(0.65, 0, 0.35, 1)` is approximated by `easeInOutCubic`. Keep
the two in sync by name if you change either.

---

## Reduced motion, concretely

| layer | normal | reduced |
|---|---|---|
| camera glide | 2200 ms eased lerp | completes on frame 1 |
| window state lerp | `k = 0.05`/frame toward target | snap to target |
| dust motes | drift + sway | frozen in place |
| window rain | 18 falling drops | **not rendered at all** |
| bloom | on | off |
| film grain | 6 s stepped drift, 3 % opacity | opacity 0, no animation |
| all CSS transitions | token durations | `0.001ms !important` |
| hover emissive lift | ×1.2 instant swap | ×1.2 instant swap (unchanged — instant already) |

Detection: a `matchMedia('(prefers-reduced-motion: reduce)')` hook writes into
the scene store; 3D code reads `store.getState().prefersReducedMotion` inside
`useFrame` rather than subscribing, to avoid re-renders.

The global CSS escape hatch:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
```

---

## Reading state inside the frame loop

A pattern used everywhere in the room and worth stating as a rule:

```ts
useFrame(() => {
  const { something } = useSomeStore.getState();   // no subscription
  const reduced = useSceneStore.getState().prefersReducedMotion;
  // ...mutate material/position refs directly
});
```

**Never subscribe a 3D component to a store value that changes per tick.** It
will re-render the React tree 60 times a second. Read imperatively in the frame
loop and mutate refs.
