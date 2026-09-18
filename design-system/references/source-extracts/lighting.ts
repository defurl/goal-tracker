// Lighting values for the desk scene. EXACT specs from `lighting-plan.svg`.
// Tune only with owner sign-off. The plan is the contract; this file mirrors it.
//
// Color routing: hexes in the SVG map to design-spec tokens from
// `src/lib/style/colors.ts` — those imports stay the single source of truth
// for the palette (also what keeps `pnpm lint:colors` happy).

// ── KEY: lamp ─────────────────────────────────────────────────────────────────
// #FFB661 = LAMP_WARM. Position is the bulb's world coordinate; the lamp's
// arm/shade geometry must agree visually (see `objects/Lamp.tsx`).
// REVISION TUNING: distance bumped 2.0 → 2.8 so the lamp's outer falloff
// reaches the keyboard zone (~20% brightness per acceptance criterion 4).
// The lighting plan's 2.0 produced too steep a falloff; the keyboard was
// outside the pool entirely.
export const LAMP_POSITION = [-0.95, 0.35, -0.2] as const;
export const LAMP_INTENSITY = 8.0;
export const LAMP_DISTANCE = 2.8;
export const LAMP_DECAY = 2;

// ── FILL: monitor 1 & 2 ──────────────────────────────────────────────────────
// #5BC8FF = VOXEL_GLOW.
// REVISION TUNING: switched from PointLight to SpotLight aimed at the
// keyboard zone. PointLights at these positions were creating two bright
// circular cyan pools right under each monitor — they read as discrete
// spotlights rather than the soft screen-glow the plan intended. SpotLights
// pointed at the keyboard zone put the fill ON the keys / fronts of objects,
// where it belongs.
export const MONITOR_FILL_POSITIONS = [
  [-0.3, 0.55, -0.4] as const,
  [0.5, 0.55, -0.4] as const,
];
export const MONITOR_FILL_TARGETS = [
  [-0.3, 0.04, 0.2] as const, // keyboard zone under monitor 1
  [0.5, 0.04, 0.2] as const, // keyboard zone under monitor 2
];
export const MONITOR_FILL_INTENSITY = 3.2;
export const MONITOR_FILL_DISTANCE = 1.5;
export const MONITOR_FILL_DECAY = 2;
export const MONITOR_FILL_ANGLE = 0.6; // ~34° cone
export const MONITOR_FILL_PENUMBRA = 0.7; // soft edges

// ── RIM: window directional ──────────────────────────────────────────────────
// #2A6B8A = VOXEL_GLOW_SOFT. Direction is FROM this position TOWARD origin.
export const WINDOW_RIM_POSITION = [1.4, 1.0, -0.6] as const;
export const WINDOW_RIM_TARGET = [0, 0.5, 0] as const;
export const WINDOW_RIM_INTENSITY = 1.2;

// ── DOOR SPILL: off-frame warm ───────────────────────────────────────────────
// #FFB661 = LAMP_WARM (same as the lamp; both warm sources).
// REVISION TUNING: moved from z=+1.0 (lighting-plan spec) → z=+0.5 and
// intensity 2.4 → 3.5. At z=+1.0 the spill's floor pool sat next to the
// lamp's own floor pool — the two warm sources merged into one indistinct
// patch instead of reading as two separate light origins. Pulling the
// spill to z=+0.5 lands it on the floor *forward* of the lamp's reach so
// the warm rectangle reads as a distinct second source (criterion 3).
// Intensity bump compensates for the steeper angle of incidence.
export const DOOR_SPILL_POSITION = [-1.8, 0.4, 0.5] as const;
export const DOOR_SPILL_INTENSITY = 3.5;
export const DOOR_SPILL_DISTANCE = 2.5;
export const DOOR_SPILL_DECAY = 2;

// ── AMBIENT ──────────────────────────────────────────────────────────────────
// #0A0F1A = BG_NIGHT.
export const AMBIENT_INTENSITY = 0.15;
