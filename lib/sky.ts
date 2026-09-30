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

export const SKY_STATES: Record<SkyBand, SkyState> = {
  night: { color: BG_NIGHT, intensity: 0.8 }, // 22–05
  dawn: { color: GLOW_COOL_SOFT, intensity: 1.1 }, // 05–08
  day: { color: GLOW_COOL_SOFT, intensity: 1.4 }, // 08–17
  dusk: { color: LAMP_WARM, intensity: DUSK_INTENSITY }, // 17–20
  evening: { color: BG_NIGHT, intensity: 0.9 }, // 20–22
};

/** Each band starts at its hour and runs to the next band's. */
export function skyBand(hour: number): SkyBand {
  if (hour >= 22 || hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 17) return 'day';
  if (hour < 20) return 'dusk';
  return 'evening';
}
