// Single source of truth for the design-spec palette in TypeScript land.
// This file and `styles/tokens.css` are the two mirrors of the palette
// declared in `design-spec.jsonc`. If you change a value in one, change it
// in the others. The guard against drift into banned hues is
// `scripts/lint-colors.ts` — run via `pnpm lint:colors` (CI enforces).
//
// BBE's palette, not the portfolio's. `design-system/tokens/` holds the
// extracted original and is an archive — it is not a fourth mirror. See D-21.
//
// Accent tokens are named by ROLE, not by hue, so the next hue change costs
// nothing: SIGNAL is whatever the accent currently is.
//
// ── The rule that is easy to miss ─────────────────────────────────────────
// SIGNAL_DIM and GLOW_COOL_SOFT drive EMISSIVE surfaces, and the bloom pass
// has `luminanceThreshold 0.1`. Changing either value without checking its
// relative luminance can silently stop a monitor blooming — which is exactly
// the regression D-20 exists to record. Measured, on these values:
//
//   SIGNAL_DIM      #8E4A5C  L 0.114  → monitor 1 at 1.1 = 0.126   blooms
//   GLOW_COOL_SOFT  #3F6B77  L 0.130  → monitor 2 at 1.0 = 0.130   blooms
//
// A darker rose was tried first and measured 0.074 at 1.1 — below the
// threshold, so the primary monitor would have gone flat for most of every
// day. If you change an emissive token, compute the luminance first.
//
// (The rejected value is deliberately not written here: this file is the
// lint's source of truth, and any hex in it that is not an exported constant
// is a violation by the lint's own rule.)

export const BG_VOID = '#05070D';
export const BG_NIGHT = '#0A0F1A';
export const BG_PANEL = '#121826';
export const BG_PANEL_2 = '#1A2230';

export const INK_PAPER = '#F0F2F5';
export const INK_MUTED = '#9BA3B4';
export const INK_FAINT = '#5A6275';
export const INK_GHOST = '#2E3340';

/** The soul colour. Primary accent, hover labels, focus rings, links. */
export const SIGNAL = '#F2A0B5';
export const SIGNAL_HOT = '#F8C3D0';
/** Faded / disabled, and monitor 1's emissive tint. See the bloom note above. */
export const SIGNAL_DIM = '#8E4A5C';

export const DATA_GREEN = '#4ADE80';
export const DATA_RED = '#F87171';
export const DATA_NEUTRAL = '#9BA3B4';

/** The cool side of the frame. Monitor fill lights. */
export const GLOW_COOL = '#7FC4D8';
/** Ambient sky bounce, window rim light, monitor 2's emissive. */
export const GLOW_COOL_SOFT = '#3F6B77';

/**
 * The desk lamp — the only truly warm light source, and the sole shadow-caster.
 * Deliberately NOT moved to the accent hue (D-21): the lamp is a physical bulb,
 * not brand colour, and it is what makes lighting acceptance criteria 1, 3 and 4
 * true. A rose key light would tint the concrete and break warm-left / cool-right.
 */
export const LAMP_WARM = '#FFB661';
export const RAIN_STREAK = '#3A4555';

export const colors = {
  bgVoid: BG_VOID,
  bgNight: BG_NIGHT,
  bgPanel: BG_PANEL,
  bgPanel2: BG_PANEL_2,
  inkPaper: INK_PAPER,
  inkMuted: INK_MUTED,
  inkFaint: INK_FAINT,
  inkGhost: INK_GHOST,
  signal: SIGNAL,
  signalHot: SIGNAL_HOT,
  signalDim: SIGNAL_DIM,
  dataGreen: DATA_GREEN,
  dataRed: DATA_RED,
  dataNeutral: DATA_NEUTRAL,
  glowCool: GLOW_COOL,
  glowCoolSoft: GLOW_COOL_SOFT,
  lampWarm: LAMP_WARM,
  rainStreak: RAIN_STREAK,
} as const;

export type ColorToken = keyof typeof colors;
