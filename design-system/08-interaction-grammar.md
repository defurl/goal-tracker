# 08 — Interaction Grammar

> There is no menu. The objects *are* the navigation. That works only if every
> object behaves identically, so the grammar below is a single wrapper component
> applied uniformly.

---

## 1. The `InteractiveObject` wrapper

Every clickable thing in the room is wrapped:

```tsx
<InteractiveObject
  id="monitor1"
  label="projects"
  labelPosition={[-0.3, 0.64, -0.4]}
  onActivate={() => focusObject('monitor1', 'projects')}
>
  <Monitor variant="primary" position={[-0.3, 0.306, -0.4]} hoverId="monitor1" />
</InteractiveObject>
```

It contributes four behaviours and nothing else.

### Desktop — hover
- `pointerOver` → set local hover + store hover, show the floating label,
  set `document.body.style.cursor = 'pointer'` (only when `onActivate` exists)
- `pointerOut` → clear all of the above
- `click` → `onActivate()`
- Always `e.stopPropagation()` so nested meshes don't double-fire

### Mobile — arm then activate
Touch has no hover, so a two-tap grammar replaces it:
- **First tap** arms the object: the label appears and stays for
  `ARM_WINDOW_MS = 3000`
- **Second tap on the same object inside that window** activates
- Tapping a different object disarms the first and arms the new one
- The timer auto-disarms; cleanup on unmount

### Keyboard / screen reader
- A visually hidden 48 × 48 px `<button>` is rendered at the label position via
  drei's `<Html>`, so the 3D object enters the tab order
- `onFocus` / `onBlur` drive the same hover state as the pointer
- `Enter` / `Space` call `onActivate`
- `:focus-visible` reveals the button: `outline: 2px solid var(--signal-amber)`,
  offset 4 px, plus a faint night-tinted backing

> 48 × 48 px is the minimum touch/focus target. Do not shrink it to match a
> small object — the hit area is allowed to be larger than the mesh.

### Label suppression
The label shows only when `label && !panelIsOpen && (hovered || armed)`.
When a detail panel is open, all in-world labels are suppressed so nothing
floats over the open content.

---

## 2. Hover feedback in the material

Hover does not move or scale the object. It lifts the emissive:

```ts
const emissiveIntensity = hovered ? base * 1.2 : base;
```

Instant swap, no tween — so it still "appears" under reduced motion. Objects
with no emissive surface (mug, plant, keyboard) currently have **no hover
feedback at all** and are not wrapped. That was a deliberate scope cut, and it
is the one place the grammar is incomplete: a non-emissive object that *is*
interactive needs its own affordance (a subtle rim, an outline pass).

---

## 3. State model

Two small `zustand` stores. Keep them this small.

```ts
// interaction
{
  hovered: string | null,        // drives label + emissive lift
  focus:   ObjectId | null,      // drives the camera rig
  panel:   PanelId | null,       // drives the DOM overlay
  setHovered, focusObject(id, panel), returnToDesk()
}

// scene
{
  current: SceneKey,
  transitioning: boolean,
  prefersReducedMotion: boolean,
  isMobile: boolean,
  ...setters
}
```

Two notes that matter:
- `panel` is **derived from** the focused object but **stored explicitly**, so a
  panel can outlive a camera glide (and survive a focus change mid-flight).
- `focusObject` clears `hovered` in the same set, so the label never lingers
  behind an opening panel.

---

## 4. The four interaction outcomes

Every object does exactly one of these. Pick one per object; do not mix.

| outcome | example | behaviour |
|---|---|---|
| **glide + panel** | monitor, notebook, phone | camera glides to focus pose, DOM panel slides in from the right |
| **glide only** | window | camera glides, no panel — a scene transition lands afterwards |
| **toggle** | headphones | no camera move, no panel, flips a global boolean |
| **transition** | the door (invisible floor disc) | full scene change behind a fade |

---

## 5. DOM overlay composition

The 3D scene is the content. The DOM is corner furniture.

| corner | contents |
|---|---|
| top-left | scene title / eyebrow label, when shown at all |
| top-right | transient panels — detail slides in here at **~480 px** |
| bottom-left | navigation — "back", breadcrumb; status badge stacked above, fading to 0 when a panel is focused |
| bottom-right | global controls — audio toggle, text-fallback link, fidelity toggle |

Rules:
- Overlay UI lives in the corners. **Never centred, never full-bleed.**
- Detail opens as a **right-hand slide-in at ~480 px**, never a centred modal.
- Generous negative space.
- **No card grids.** No "feature box" layouts. If you reach for a grid, stop.

---

## 6. Non-3D fallback

Every piece of content must also be reachable at a plain `/text` route that
renders without WebGL, for screen readers and no-WebGL clients. The portfolio
prerenders this route at build time. This is not a nice-to-have — it is the
a11y story for a site whose primary navigation is a 3D object.

---

## 7. Audio

- **Audio is OFF by default.** Auto-playing audio on first paint is an explicit
  anti-pattern.
- The toggle is the most prominent UI element on first paint.
- In the portfolio, the physical headphones on the desk are a second, in-world
  affordance for the same toggle — an object and a control that agree.
- Built on `tone` (Tone.js). Lo-fi bed at ~0.3 gain, distant room hum,
  occasional weather. Sharp sounds only for discrete events.
