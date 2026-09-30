/**
 * The hall's rig (design-system/13 §5, lighting plan 13-hall-lighting-plan.svg).
 * The room's five roles and six instances, nothing added: KEY, FILL ×2, RIM,
 * DOOR SPILL, AMBIENT. **Do not add a light.**
 *
 * The hall's own frame: y = 0 is its floor. Values are tuned against the hall's
 * acceptance test (§5), and each tuned value records why, as the room's
 * lighting.ts does. The note's starting intensities assumed the room's numbers
 * would scale by ratio alone; they do not, because a point light's reach falls
 * with the square of distance and the hall is six times the room's height, so
 * the key here is brighter in raw units while holding the same roles.
 */

// ── KEY: the pendant over the tree ───────────────────────────────────────────
// LAMP_WARM, the sole shadow-caster. Its pool — the tree and the floor under it
// — is criterion 1's brightest area.
export const HALL_KEY_POSITION = [-0.6, 2.5, 0.3] as const;
export const HALL_KEY_INTENSITY = 60;
export const HALL_KEY_DISTANCE = 6;
export const HALL_KEY_DECAY = 2;
export const HALL_SHADOW_MAP = 1024;
export const HALL_SHADOW_BIAS = -0.0005;
/**
 * The shadow camera's near plane. three's default, 0.5 m, is further than the
 * shade (0.2 m from the bulb), so the shade would cast nothing and the light
 * would reach the wall above the band it is meant to be cut off from.
 */
export const HALL_SHADOW_NEAR = 0.05;

// ── FILL ×2: the history wall washed from the floor ──────────────────────────
// GLOW_COOL, aimed up the band: in the room the screens glow; here the wall is
// the screen.
export const HALL_FILL_POSITIONS = [
  [-2.0, 0.1, -0.9],
  [2.0, 0.1, -0.9],
] as const;
export const HALL_FILL_TARGETS = [
  [-2.0, 1.3, -1.5],
  [2.0, 1.3, -1.5],
] as const;
export const HALL_FILL_INTENSITY = 3;
export const HALL_FILL_DISTANCE = 3;
export const HALL_FILL_DECAY = 2;
export const HALL_FILL_ANGLE = 0.9;
export const HALL_FILL_PENUMBRA = 1;

// ── RIM: the clerestory ──────────────────────────────────────────────────────
// GLOW_COOL_SOFT, following the hour as the room's does (lib/sky.ts
// RIM_STATES), scaled for the bigger space.
export const HALL_RIM_POSITION = [3.3, 2.0, -0.8] as const;
export const HALL_RIM_TARGET = [0, 1, -1] as const;
export const HALL_RIM_SCALE = 3;

// ── DOOR SPILL: the room, seen from outside ──────────────────────────────────
// LAMP_WARM through the doorway you came in by: the warm rectangle on the floor
// at camera-left, criterion 3.
export const HALL_SPILL_POSITION = [-3.8, 1.0, -1.0] as const;
export const HALL_SPILL_INTENSITY = 4;
export const HALL_SPILL_DISTANCE = 3.5;
export const HALL_SPILL_DECAY = 2;

// ── AMBIENT ──────────────────────────────────────────────────────────────────
// BG_NIGHT, the room's value: ambient does not fall off with distance, so it
// does not scale with the space.
export const HALL_AMBIENT_INTENSITY = 0.15;
