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

export const SKY_STATES: Record<SkyBand, SkyState> = {
  night: { color: BG_NIGHT, intensity: 0.8 }, // 22–05
  dawn: { color: GLOW_COOL_SOFT, intensity: 1.1 }, // 05–08
  day: { color: GLOW_COOL_SOFT, intensity: 1.4 }, // 08–17
  dusk: { color: LAMP_WARM, intensity: 1.0 }, // 17–20
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
