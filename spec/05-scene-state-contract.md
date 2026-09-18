# 05 — Scene State Contract

> Status: **LOCKED.** This is the seam between the application and the room.
>
> **Neither side owns this file.** The data layer writes into the store; the
> scene reads from it; the `/text` route reads the same store. If either side
> needs a change here, it is a shared change and both sides re-read it.
>
> The reason this document exists: the data work and the 3D work are the two
> largest parallel workstreams in this project, and this is the only place they
> touch. Get it right and they can proceed independently for weeks.

---

## 1. The rule that governs everything

From `../design-system/10-tech-stack.md` §5 and `03-motion.md`:

> **The 3D scene reads from a store, never from the network.**
> A data layer writes into the store; the scene observes it inside `useFrame`
> via `getState()`.

And its corollary, which is a performance requirement and not a style
preference:

> **Never subscribe a 3D component to a store value that changes per tick.**
> It will re-render the React tree 60 times a second. Read imperatively in the
> frame loop and mutate refs.

```ts
// Correct — inside a scene object
useFrame(() => {
  const { challengeComplete } = useAppStore.getState();   // no subscription
  const reduced = useSceneStore.getState().prefersReducedMotion;
  materialRef.current.emissiveIntensity = lerpTo(
    materialRef.current.emissiveIntensity,
    challengeComplete ? 1.4 : 0.6,
    reduced ? 1 : 0.05,
  );
});
```

```ts
// Wrong — re-renders the subtree on every change
const challengeComplete = useAppStore(s => s.challengeComplete);
```

DOM components in `overlay/` and the `/text` route **do** subscribe normally.
The imperative-read rule applies only inside `useFrame`.

---

## 2. Store shape

Three stores. Keep them this small — the portfolio shipped with two and the
discipline is what kept the scene fast.

### `useAppStore` — application state (new for BBE)

The only store the data layer writes to.

```ts
interface AppState {
  // ── Feature 1: Daily Challenge ──────────────────────────────
  challenge: {
    id: string | null;
    actionText: string;
    sourceSummary: string;
    sourceUrl: string | null;
    complete: boolean;
    rollCount: number;
    rollsRemaining: number;
  } | null;                         // null = no pending actions (FR-1.7 empty state)

  importing: boolean;               // phone screen brightens while true

  // ── Feature 2: Habits ───────────────────────────────────────
  points: {
    total: number;                  // authoritative, server-owned
    today: number;
    leafCount: number;              // DERIVED from total — see §4
  };
  habits: HabitSummary[];
  dayGrid: DayCell[];               // 365 entries, oldest first

  // ── Feature 3: Journal ──────────────────────────────────────
  journal: {
    todayLogged: boolean;
    reflectionsRemaining: number;
  };

  // ── Feature 4: Goals ────────────────────────────────────────
  goals: GoalSummary[];

  // ── Ambient ─────────────────────────────────────────────────
  localHour: number;                // 0–23, user's timezone. Drives the window.
  focusMode: boolean;               // headphones toggle

  // ── Lifecycle ───────────────────────────────────────────────
  hydrated: boolean;                // false until first load completes
  offline: boolean;
}

type DayCell = 0 | 1 | 2;           // 0 unfilled · 1 filled · 2 today

interface HabitSummary {
  id: string;
  name: string;
  type: 'build' | 'break';
  dueToday: boolean;
  completedToday: boolean;
  streak: number;
  longestStreak: number;
}

interface GoalSummary {
  id: string;
  title: string;
  category: GoalCategory;
  progress: number;                 // 0–1, milestones complete / total
  startDate: string;                // ISO date
  targetDate: string;
}
```

### `useInteractionStore` — carried over unchanged

```ts
interface InteractionState {
  hovered: string | null;                   // drives label + emissive lift
  focus: ObjectId | null;                   // drives the camera rig
  panel: PanelId | null;                    // drives the DOM overlay
  setHovered(id: string | null): void;
  focusObject(id: ObjectId, panel: PanelId): void;
  returnToDesk(): void;
}
```

Two properties to preserve from the portfolio: `panel` is **derived from** the
focused object but **stored explicitly**, so a panel can outlive a camera glide;
and `focusObject` clears `hovered` in the same `set`, so a label never lingers
behind an opening panel.

### `useSceneStore` — carried over unchanged

```ts
interface SceneState {
  current: SceneKey;
  transitioning: boolean;
  prefersReducedMotion: boolean;
  isMobile: boolean;
  lowFps: boolean;                          // from useAdaptiveFps
}
```

---

## 3. State → surface mapping

The complete list of room surfaces driven by application state. **Every entry
lerps; nothing pops.** Under `prefersReducedMotion`, every lerp snaps (`k = 1`).

| Store value | Surface | Mapping | Lerp |
|---|---|---|---|
| `challenge.complete` | Monitor 1 emissive intensity | `false → 1.1`, `true → 1.4` (D-20) | `k = 0.05` |
| `challenge.actionText` | Monitor 1 canvas texture | redraw on change | n/a — discrete |
| `importing` | Phone screen emissive colour | `VOXEL_GLOW_SOFT → SIGNAL_AMBER_DIM` | `k = 0.08` |
| `points.leafCount` | Bonsai `InstancedMesh` count | one leaf per unit | 900 ms reveal per leaf |
| `dayGrid[]` | Wall grid instance colours | `0 → INK_GHOST` (non-emissive) · `1 → SIGNAL_AMBER_DIM` @ 0.5 · `2 → SIGNAL_AMBER` @ 0.9 | `k = 0.05` |
| `goals[].progress` | Monitor 2 canvas texture | redraw on change | n/a — discrete |
| `journal.todayLogged` | Notebook emissive | `false → 0.0`, `true → 0.15` (barely lit) | `k = 0.05` |
| `localHour` | Window sky plane `{color, intensity}` | lookup table, §5 | `k = 0.05` |
| `focusMode` | Ambient audio gain | `0 → 0.3` | 600 ms |

**Nothing else in the room reacts to application state.** Adding a surface to
this table is a design change that needs the lighting acceptance test re-run,
not an implementation detail.

### The 5 % rule still applies

From `../design-system/04-room-spec.md` §6: state changes shift the environment
by a barely-perceptible amount. You notice after twenty minutes, not instantly.
**Resist making state legible at a glance in the 3D layer — that is what the DOM
panels are for.** The wall grid at rest pose should read as *texture*, not as
data. If a reviewer can count their completed days from the rest pose, the
emissive values are too high.

---

## 4. `leafCount` is derived, and derived in exactly one place

`points.total` is server-owned and authoritative. `leafCount` is computed from
it, and the computation lives in **one** exported function that both the scene
and `/text` import. Two implementations of this will drift, and the drift shows
up as the bonsai disagreeing with the number next to it.

```ts
// lib/growth.ts — the single source of truth
export function leafCountForPoints(total: number): number {
  if (total < 20) return 0;
  // 20/45/70/100, then every 100 — asymptotic, not unbounded
  ...
}
```

Thresholds are **PROPOSED** at 20 / 45 / 70 / 100 then every 100, with the curve
flattening so a long-term user gets a full bonsai rather than a shrub. Tune with
the owner once there is a real points history to look at; until then these are
defensible placeholders and the function signature is what matters.

**Never decrease.** `leafCountForPoints` is monotonic because `points.total` is
monotonic — there are no negative ledger rows (`03-data-model.md` §4). If a leaf
ever disappears, something upstream is broken and it is a bug, not a state.

---

## 5. Window state table

`localHour` drives the window sky plane through a lookup table — the pattern
from `../design-system/04-room-spec.md` §6, rewired from market state to time.

```ts
const SKY_STATES: Record<Band, { color: string; intensity: number }> = {
  night:   { color: BG_NIGHT,        intensity: 0.8 },   // 22–05
  dawn:    { color: VOXEL_GLOW_SOFT, intensity: 1.1 },   // 05–08
  day:     { color: VOXEL_GLOW_SOFT, intensity: 1.4 },   // 08–17
  dusk:    { color: LAMP_WARM,       intensity: 1.0 },   // 17–20
  evening: { color: BG_NIGHT,        intensity: 0.9 },   // 20–22
};
```

**The room stays nocturnal at every hour** (`00-product-brief.md` §1, LOCKED).
Even `day` keeps the interior dark — the window brightens, the room does not.
The rim light may rise slightly with it; if it does, re-run the lighting
acceptance test at both extremes.

The city plane below keeps its portfolio behaviour: base `VOXEL_GLOW_SOFT`,
lerped **only 5 %** toward a target. Do not repurpose it for BBE state — it is
doing atmospheric work and a second signal there would compete with the window.

---

## 6. Who writes what

| Writer | Writes | Never writes |
|---|---|---|
| Data layer (`lib/data/*`) | every `useAppStore` field | interaction, scene |
| `InteractiveObject` wrapper | `hovered`, `focus`, `panel` | app state |
| `useAdaptiveFps` | `lowFps` | anything else |
| Reduced-motion hook | `prefersReducedMotion` | anything else |
| **Scene objects** | **nothing** | **everything** |

Scene objects are pure readers. An object that writes to a store has stopped
being a view and become a controller, and it will be the thing that breaks when
two objects disagree about the same value.

The one permitted exception is going *through* the interaction wrapper: an
object's `onActivate` calls `focusObject(...)`. That is the wrapper's write,
injected from outside, not the object's.

### Write discipline

The data layer writes the store **after** the server confirms, with one
exception: optimistic habit check-off (FR-2.8, < 100 ms). That path writes
optimistically, then reconciles. When reconciliation disagrees with the
optimistic value, **the server wins silently** — no error toast, no flash. A
user who tapped a habit and saw it tick should not then watch it untick with an
explanation; log it and move on.

---

## 7. Hydration and the empty room

`hydrated` is `false` until the first load completes. Before that:

- The room renders **fully lit and complete** — lamp, monitors, desk, walls, all
  of it. It is a place, and a place does not fade in.
- Monitor 1 shows a resting state, not a spinner. Monitor 2 shows an empty
  goals frame. The wall grid renders all cells `INK_GHOST` — which is
  indistinguishable from a genuinely empty tracker, and that is correct.
- The bonsai renders with `leafCount = 0`: a bare bonsai, not a missing object.

This matters because `../design-system/11-anti-patterns.md` forbids loading
screens with rotating tips, and because the room's whole proposition is that it
is a space you enter rather than a page that loads. **A new user and a loading
user see the same room.** The only difference is what arrives in it.

Offline (`offline: true`): the room renders from the last cached store snapshot
and the `/text` route serves the shell. Nothing in the 3D layer indicates
offline state — the corner furniture does, per `08-interaction-grammar.md` §5.

---

## 8. `/text` reads the same store

The `/text` route is not a separate application. It subscribes to `useAppStore`
normally (no `useFrame`, so no imperative-read constraint) and renders the same
values as prose and controls.

This is what keeps D-07 honest: one data layer, one store, two presentations. A
feature added to the store appears in both surfaces, and a feature that somehow
only works in one of them is visible as such in review.

**The hard constraint:** `/text` must not transitively import three.js
(`01-decisions.md` D-10). Shared modules — `lib/growth.ts`, the store, types —
must be free of scene imports. Assert it in CI, because a careless
`import type { Vector3 }` is enough to pull the whole renderer into the entry
bundle and nobody notices until the bundle check fires.
