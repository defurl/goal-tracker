# 11 — Anti-Patterns (Hard No)

> Carried verbatim from the portfolio's design contract. These are not
> preferences to weigh; they are the boundary of the aesthetic. If a design
> lands on this list, it is wrong regardless of how well it is executed.

## Typography
- Inter, Roboto, Arial or `system-ui` as a primary typeface
- Hero text that scales with scroll (parallax type)
- "Hi, I'm [name]" as a primary headline

## Colour and surface
- Purple-to-pink gradients, indigo-to-cyan gradients, any "modern SaaS" gradient
- Glass-morphism panels (backdrop-blur on translucent white)
- Pure white `#FFFFFF`
- A light-mode toggle
- Skeuomorphic "realistic glow" that tries to look like hardware

## Layout
- Card grids and "feature box" layouts
- Centred modals for detail content
- Skill bars, percentage proficiencies, technology logo grids

## Motion and input
- Auto-playing audio on first paint
- Mouse-trailing particles; custom cursors not justified by the metaphor
- Scroll-jacking that disables native scroll speed
- Loading screens with rotating tips — show a quiet progress bar

## Other
- Cookie banners (no tracking → no banner)

---

## Additions proposed for the habit tracker

These are not from the original contract. They follow from the domain, and the
new team should ratify or reject them explicitly.

- **No streak-shaming.** No red counters, no "you broke your streak", no wilting
  or dying plants. `--data-red` is for live data, not for judging the user.
- **No confetti, no badge pop, no achievement chime on completion.** Completion
  is a drop of water and a barely-visible growth increment. The reward is the
  accumulated room, not the moment.
- **No progress ring over every object.** Percentages belong in the DOM panel,
  not floating in the 3D scene. The room signals state through *light and
  growth*, not through HUD chrome.
- **No gamified levelling language** — XP, tiers, leaderboards. The metaphor is
  a room you live in, not a game you win.
