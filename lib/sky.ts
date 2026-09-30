// The window's sky by hour — spec/05 §5 (LOCKED), build plan 3.7.
//
// Pure data and one lookup, so the table can be tested without a scene. The
// window lerps its sky plane toward the band's `{ color, intensity }` at
// k = 0.05. The room stays nocturnal at every hour (00-product-brief §1): the
// window brightens, the room does not — these planes are emissive only and
// light nothing.

import { BG_NIGHT, GLOW_COOL_SOFT, LAMP_WARM } from './style/colors.ts';

export type SkyBand = 'night' | 'dawn' | 'day' | 'dusk' | 'evening';

export interface SkyState {
  color: string;
  intensity: number;
}

/**
 * Dusk is the one warm band, and the window sits on the room's cool side:
 * criterion 2 of the lighting test wants the right edge cooler than the left.
 * At spec/05's LAMP_WARM × 1.0 (L ≈ 0.556) the sky bloomed there once the
 * window was in frame. Owner decision 2026-09-30, D-23 §12: dusk stays under
 * the 0.1 bloom threshold — 0.556 × 0.16 ≈ 0.089. Still warm, no longer a lamp.
 */
export const DUSK_INTENSITY = 0.16;

/**
 * The daylit window (A5.4, D-24 §9, design-system/12 §6 option 2): by day the
 * sky goes to a bright cool value. PROPOSED: at 2.0 the pane read as a dim
 * evening blue through the glass (which transmits 0.55 of it, tinted); at 4.0
 * it reads as an overcast day, and the lighting test holds at noon with
 * effects on and off. At rest the sky is out of frame at 16:10 — only the
 * city strip shows — so this is seen from the window's glide. The window is
 * emissive only, so it brightens the pane and nothing in the room;
 * RIM_STATES carries the daylight in.
 *
 * Luminance-checked (D-21): GLOW_COOL_SOFT is L ≈ 0.131, so 4.0 is ≈ 0.52,
 * over the 0.1 bloom threshold on purpose — as 1.4 (≈ 0.18) already was. The
 * pane is daylight and it glows, on the cool side where criterion 2 wants
 * cool. The warm band is the one that must stay under (DUSK_INTENSITY).
 */
export const DAY_INTENSITY = 4.0;

export const SKY_STATES: Record<SkyBand, SkyState> = {
  night: { color: BG_NIGHT, intensity: 0.8 }, // 22–05
  dawn: { color: GLOW_COOL_SOFT, intensity: 1.1 }, // 05–08
  day: { color: GLOW_COOL_SOFT, intensity: DAY_INTENSITY }, // 08–17
  dusk: { color: LAMP_WARM, intensity: DUSK_INTENSITY }, // 17–20
  evening: { color: BG_NIGHT, intensity: 0.9 }, // 20–22
};

/**
 * The window rim light's intensity by band (A5.4, 12 §6 option 2: "the rim
 * light intensity rises with it, 1.2 → ~2.5"). Night, evening and dusk keep
 * the rig's 1.2 (scene/lighting.ts WINDOW_RIM_INTENSITY), so the room the
 * acceptance test was tuned on is the room after dark. PROPOSED values between.
 * The rim lerps toward these at the sky's k = 0.05.
 */
export const RIM_STATES: Record<SkyBand, number> = {
  night: 1.2,
  dawn: 1.8,
  day: 2.5,
  dusk: 1.2,
  evening: 1.2,
};

/** Each band starts at its hour and runs to the next band's. */
export function skyBand(hour: number): SkyBand {
  if (hour >= 22 || hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 17) return 'day';
  if (hour < 20) return 'dusk';
  return 'evening';
}
