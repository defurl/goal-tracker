/**
 * Lighting constants for the room. Five roles, six instances — that is the
 * whole rig (design-system/05-lighting-rig.md). **Do not add a light.**
 *
 * `../lighting-plan.svg` is the visual contract and outranks this file's prose;
 * where the two differ, the differences below are the revision-tuned values
 * that actually shipped, and each one records WHY it differs. `10-tech-stack.md`
 * calls this file "the single most valuable artefact in the whole project" for
 * exactly that reason: when a value gets tuned, the reason is recorded next to
 * it. Keep that habit.
 *
 * Colours come from lib/style/colors.ts. Note that D-21 changed two of them:
 * the monitor fill and the window rim are now the desaturated cool tokens, and
 * acceptance criterion 2 ("the right edge reads measurably cooler than the
 * left") must be re-verified against the rendered frame, not assumed.
 */

// ── KEY: the desk lamp ───────────────────────────────────────────────────────
// LAMP_WARM. Position must equal the bulb mesh's world coordinate.
// The ONLY shadow-caster in the scene: one shadow source keeps contact shadows
// readable and the GPU cost flat.
//
// TUNING: distance raised 2.0 -> 2.8. At 2.0 the falloff was too steep and the
// keyboard fell outside the pool entirely, failing acceptance criterion 4.
export const LAMP_POSITION = [-0.95, 0.35, -0.2] as const;
export const LAMP_INTENSITY = 8.0;
export const LAMP_DISTANCE = 2.8;
export const LAMP_DECAY = 2;
export const LAMP_SHADOW_MAP = 1024;
export const LAMP_SHADOW_BIAS = -0.0005;

// ── FILL x2: monitor glow ────────────────────────────────────────────────────
// GLOW_COOL.
//
// TUNING: these were pointLights in the plan. Point lights here produced two
// bright circular cyan puddles directly under each monitor — they read as
// discrete spotlights, not screen glow. Spot lights AIMED AT THE KEYBOARD put
// the cool fill on the front faces of objects, which is where screen glow
// actually lands. Generalisable: screen glow is directional, not radial.
//
// Each spot light needs a persistent Object3D as its .target, created once in a
// useMemo and mounted with <primitive object={target} />.
export const MONITOR_FILL_POSITIONS = [
  [-0.3, 0.55, -0.4],
  [0.5, 0.55, -0.4],
] as const;
export const MONITOR_FILL_TARGETS = [
  [-0.3, 0.04, 0.2], // keyboard zone under monitor 1
  [0.5, 0.04, 0.2], // keyboard zone under monitor 2
] as const;
export const MONITOR_FILL_INTENSITY = 3.2;
export const MONITOR_FILL_DISTANCE = 1.5;
export const MONITOR_FILL_DECAY = 2;
export const MONITOR_FILL_ANGLE = 0.6; // ~34 degree cone
export const MONITOR_FILL_PENUMBRA = 0.7;

// ── RIM: the window ──────────────────────────────────────────────────────────
// GLOW_COOL_SOFT. Direction is FROM this position TOWARD the target, so this
// is what gives right-hand edges their cool separation against the back wall.
// Also needs an Object3D target.
export const WINDOW_RIM_POSITION = [1.4, 1.0, -0.6] as const;
export const WINDOW_RIM_TARGET = [0, 0.5, 0] as const;
export const WINDOW_RIM_INTENSITY = 1.2;

// ── DOOR SPILL: off-frame warm ───────────────────────────────────────────────
// LAMP_WARM. There is no door geometry. This light IS the doorway: it lays a
// warm rectangle on the floor at camera-left, implying a lit hallway outside
// the frame. A light source off-frame implies a space off-frame.
//
// TUNING: moved from z=+1.0 -> z=+0.5 and intensity 2.4 -> 3.5. At z=+1.0 the
// spill's floor pool sat adjacent to the lamp's own and the two warm sources
// merged into one indistinct patch instead of two origins, failing criterion 3.
// The intensity bump compensates for the steeper angle of incidence.
export const DOOR_SPILL_POSITION = [-1.8, 0.4, 0.5] as const;
export const DOOR_SPILL_INTENSITY = 3.5;
export const DOOR_SPILL_DISTANCE = 2.5;
export const DOOR_SPILL_DECAY = 2;

// ── AMBIENT ──────────────────────────────────────────────────────────────────
// BG_NIGHT. Barely there. Its only job is to keep the darkest surfaces from
// crushing to pure black (criterion 5). Tinted with the background colour
// rather than white — that is what keeps the shadows navy rather than grey.
export const AMBIENT_INTENSITY = 0.15;

// ── Bloom ────────────────────────────────────────────────────────────────────
// The threshold is low on purpose: it has to catch three very different
// luminances — the lamp bulb (~0.55), monitor 1's emissive (~0.126 after D-21)
// and monitor 2's (~0.130). Raising it silently stops a monitor blooming.
export const BLOOM_INTENSITY = 0.9;
export const BLOOM_LUMINANCE_THRESHOLD = 0.1;
export const BLOOM_LUMINANCE_SMOOTHING = 0.4;
