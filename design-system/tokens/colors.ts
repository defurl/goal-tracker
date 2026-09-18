// Single source of truth for the design-spec palette in TypeScript land.
// This file and `src/styles/tokens.css` are the two mirrors of the palette
// declared in `design-spec.jsonc`. If you change a value in one, change it
// in the others. The guard against drift into banned hues is
// `scripts/lint-colors.mjs` — run via `pnpm lint:colors` (CI enforces).

export const BG_VOID = '#05070D';
export const BG_NIGHT = '#0A0F1A';
export const BG_PANEL = '#121826';
export const BG_PANEL_2 = '#1A2230';

export const INK_PAPER = '#EDE6D3';
export const INK_MUTED = '#9BA3B4';
export const INK_FAINT = '#5A6275';
export const INK_GHOST = '#2E3340';

export const SIGNAL_AMBER = '#FFA630';
export const SIGNAL_AMBER_HOT = '#FFD27A';
export const SIGNAL_AMBER_DIM = '#7A4F18';

export const DATA_GREEN = '#4ADE80';
export const DATA_RED = '#F87171';
export const DATA_NEUTRAL = '#9BA3B4';

export const VOXEL_GLOW = '#5BC8FF';
export const VOXEL_GLOW_SOFT = '#2A6B8A';

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
  signalAmber: SIGNAL_AMBER,
  signalAmberHot: SIGNAL_AMBER_HOT,
  signalAmberDim: SIGNAL_AMBER_DIM,
  dataGreen: DATA_GREEN,
  dataRed: DATA_RED,
  dataNeutral: DATA_NEUTRAL,
  voxelGlow: VOXEL_GLOW,
  voxelGlowSoft: VOXEL_GLOW_SOFT,
  lampWarm: LAMP_WARM,
  rainStreak: RAIN_STREAK,
} as const;

export type ColorToken = keyof typeof colors;
