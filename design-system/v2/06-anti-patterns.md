# 06 — Anti-patterns (hard no)

Replaces `../11-anti-patterns.md` under D-26. A design that lands on this list
is wrong however well it is made. To change the list, raise it with the owner
and amend D-26 first.

## Left the list on 2026-10-29 (D-26)

- **Inter** as a typeface: it is the body face now (D-26 §10).
- **Cards and a menu:** boards of cards and a top menu are the interface
  (D-04's amendment).
- **A light room:** the room is warm and light. A theme toggle is still a no.
- **Translucent panels:** allowed only as near-opaque cards whose text contrast
  does not depend on what is behind them.

## Visual

- Gradients of any kind (D-26 §10)
- Italic headings; wide letter-spacing; rows of all-caps labels
- Corner radii above 12 px; pill-shaped buttons
- Pure white `#FFFFFF`
- Colour as the only carrier of meaning
- Any app interface drawn on a laptop, monitor or phone screen in the room
- Skeuomorphic glow that tries to look like hardware

## Layout and interaction

- Centred modal dialogs. A board is a full layer, and a destructive action arms,
  then fires (D-22 §5)
- Infinite feeds, in Self Care, Skills or anywhere else
- Scroll-jacking; a camera that scrolls with the content
- Autoplaying audio; mouse-trailing particles; custom cursors
- Loading screens with rotating tips; bare spinners (spec/02 X-2)
- A cookie banner. The analytics tool is still open in D-26; the
  recommendation is a cookieless one, which keeps this rule true

## Domain

- Streak-shaming, red counters, wilting plants, "you lost your streak" copy
  (D-08, D-09)
- Confetti, badge pops and achievement chimes (D-05)
- Levelling language, XP, tiers and leaderboards
- Skill bars and proficiency percentages: watching a video is not proof of a
  skill (functional specification §6)
- A progress ring floating over an object in the room
- Tasks created automatically from private writing (functional specification
  §2)
- Anything an AI made, saved before the user approved it (D-26 §8)
- A summary of a source nobody could read (D-26 §8)

## The shop (D-26 §6)

- Real money, now or as a shortcut
- Random rewards and loot boxes
- Limited-time items and rising prices
- Comparing rooms with other people
- Taking back an item the user owns
- A purchase shown as a negative number
