# 00 — Aesthetic Thesis

> One sentence. If a design decision cannot be defended against it, it does not
> belong in the project.

## The original thesis (portfolio)

> **"Late-night quant terminal meets a Ghibli-quiet voxel city — atmospheric,
> characterful, technically reverent."**

## Mood anchors

- 3 a.m., the city is asleep, you're not
- the hum of a server room next door
- rain on a single windowpane
- lo-fi at 30 % volume, ambient enough to forget
- the desk lamp is warm, the monitors are cold
- Minecraft, but rendered by someone who cares about light

---

## What carries over, literally

The *room* is the asset. Specifically:

1. **One warm key light in a very dark space.** Everything else is falloff.
2. **A warm/cool horizontal gradient** across the frame: lamp at camera-left,
   window at camera-right.
3. **Raw board-formed concrete** walls with panel joints and tie-rod holes —
   Tadao Ando, not office drywall.
4. **Objects as navigation.** There is no menu. You click the thing.
5. **Ambient motion that never stops** — dust, rain, a lerping window — and
   that goes completely still under `prefers-reduced-motion`.
6. **State expressed as barely-perceptible hue shifts** in the environment,
   with the readable version in a DOM panel.

---

## Writing the habit tracker's thesis

Do not reuse the quant-terminal sentence. The room is the same; the reason for
being in it is not. Write a new one-sentence thesis before writing any code,
and then hold every decision against it.

A starting point, to be replaced by the owner's own words:

> *"The same 3 a.m. desk, but you are building something on it — a room where
> the evidence of your own consistency accumulates in the furniture."*

Two shifts follow from that, and they should be decided deliberately:

- **Time of day.** The portfolio room is permanently nocturnal — the design
  spec says outright "there is no light mode and we are not building one."
  A habit tracker has a natural daily cycle, and a room that warms toward
  morning and cools toward night would be doing real work. This is the single
  biggest open question in the handoff. See `12-habit-tracker-adaptation.md` §6.
- **Emotional register.** The portfolio room is *reverent and still*. A habit
  tracker touches streaks, misses and guilt. The room must not become a place
  that punishes. Growth (the tree) should be additive and slow; absence should
  read as quiet, never as decay. Decide this before the first frame is drawn.
