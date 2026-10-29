# 04 — Boards, navigation and motion

From the UI/UX specification §2, §6-7 and the functional specification §2.
**PROPOSED** unless a decision is cited.

## Navigation

The top menu and the room's objects open the same five boards: Today, Journal,
Growth Map, Skills and Self Care (D-26 §4). Settings and Decorate are reached
from the overview's top-right corner, not from the menu.

| state | what happens |
|---|---|
| Overview | The whole room. Hovering or focusing a hotspot shows its name in a small capsule. The menu is always visible |
| Transition | The camera travels to the module's anchor: a real camera move, 650-950 ms (800 proposed), ease in-out |
| Focused | The camera settles. The room blurs with a soft ivory tint, rendering pauses, and the cards fade in with a slight stagger |
| Switch | Another menu item: the camera travels straight to the next anchor, without returning to the overview |
| Back home | Home reverses to the overview. Unsaved text is kept by the draft rules below |
| Fallback | Reduced motion, no WebGL, or a phone: no travel. The board appears over a blurred still of its anchor |

- Every hotspot has a hidden 48 x 48 px button in the tab order (spec/02 X-3).
  Its name capsule is HTML, and its line icon is allowed there (D-12's
  amendment).
- Escape returns to the overview. Every module is reachable from the menu
  without hover and without WebGL (UI/UX §9).
- No app interface appears on a laptop, monitor or phone screen in the room
  (UI/UX §9).

## Motion

| motion | duration | under reduced motion |
|---|---|---|
| Camera travel | 650-950 ms, 800 proposed | removed: a cut to the anchor's still |
| Blur and ivory tint | `--dur-ui` (600 ms), after the camera settles | a cut |
| Cards in | `--dur-ui`, 8 px rise, 60 ms stagger | a cut, no stagger |
| A check-off | `--dur-tick` (180 ms), the one fast motion (D-05) | the state changes, nothing moves |
| Ambient (pets breathing, dust) | always on | removed, not slowed (D-05) |

Rendering stops while a board is open over the blurred room, and starts again
on Back home. The blur is applied once to a still frame, not every frame.

## One board set, two backdrops

The room page mounts the boards over the live canvas. `/text`, phones and any
browser without WebGL mount the same boards over a still of the anchor. `/text`
still never loads three.js (D-10), and the offline shell caches the stills
(D-07).

## States every board handles

From the functional specification §2 and the UI/UX specification §7:

- **Loading:** a skeleton of the card, never a bare spinner (spec/02 X-2).
- **Empty:** a kind invitation with the first action, never a row of zeros.
- **Saving:** idle, dirty, saving, saved, failed. A failed save keeps the text
  and offers retry.
- **Errors:** validation, network, permission denied, source unavailable. Each
  says what happened and what to do, in words.
- **Leaving unsaved text:** no dialog. The first press of Home or a menu item
  says what would be lost and offers to keep it; a second press within
  `ARM_WINDOW_MS` leaves (D-22 §5).
- **Completion:** pending, done, skipped, paused. A quiet acknowledgment; skipped
  is never shown as failed.

## Signing out with a journal on the device

D-26 §5 and D-22's amendment. The first press arms and says, in place: "Signing
out deletes the journal on this device (12 entries). Export it first?" with an
Export action beside it. A second press within `ARM_WINDOW_MS` signs out and
deletes. With no entries on the device, sign-out works as today. **PROPOSED
copy.**

## Copy

| say | never |
|---|---|
| "A small step counts." | "You failed your streak." |
| "This may be a pattern worth exploring." | "AI has discovered your personality." |
| "Not enough entries to draw a trend yet." | A trend drawn from too little data |
| "Source could not be read. Paste the relevant text." | A summary of a source nobody could read |
| "Take a different kind of break?" | "Stop wasting time." |
| "120 points left" after a purchase | "-80 points" |
