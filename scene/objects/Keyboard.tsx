// A1.6 — the keyboard. design-system/04-room-spec.md §5.
//
// A TKL board built from hand-placed keycaps. It has to be recognisable in
// silhouette, not realistic: caps are muted and carry no legends, because
// legends at this scale are illegible noise that reads as dirt.
//
// It is also the surface the two monitor fill lights aim at
// (MONITOR_FILL_TARGETS), so it is what catches the cool screen glow.
//
// Mobile collapses 14x5 to 8x3 — same silhouette, a third of the draw calls.

import { type ReactElement } from 'react';

import { BG_PANEL_2, INK_FAINT, INK_GHOST } from '../../lib/style/colors';
import { useSceneStore } from '../../lib/stores/scene';

const COLS_DESKTOP = 14;
const ROWS_DESKTOP = 5;
const COLS_MOBILE = 8;
const ROWS_MOBILE = 3;

const CAP_W = 0.022;
const CAP_D = 0.022;
const CAP_H = 0.01;
const GAP = 0.0035;
const PLATE_PAD = 0.02;
const PLATE_H = 0.012;
const BODY_H = 0.006;
const BODY_DROP = 0.008;

/** Distance from the group origin down to the underside of the lower body. */
export const KEYBOARD_DROP = BODY_DROP + BODY_H / 2;

interface KeyboardProps {
  /** Group origin. Pass y = KEYBOARD_DROP to stand it on the desk. */
  position: [number, number, number];
}

export function Keyboard({ position }: KeyboardProps) {
  // Read once per render, not per frame — the breakpoint changes on resize,
  // which is not a per-tick value (spec/05 §3).
  const isMobile = useSceneStore((s) => s.isMobile);
  const cols = isMobile ? COLS_MOBILE : COLS_DESKTOP;
  const rows = isMobile ? ROWS_MOBILE : ROWS_DESKTOP;

  const totalW = cols * CAP_W + (cols - 1) * GAP;
  const totalD = rows * CAP_D + (rows - 1) * GAP;

  const caps: ReactElement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // The bottom row drops its middle caps for one wide spacebar.
      const isSpaceArea = r === rows - 1 && c >= 4 && c <= 9;
      if (isSpaceArea && c !== 4) continue;
      const wide = isSpaceArea ? CAP_W * 6 + GAP * 5 : CAP_W;
      const cx = -totalW / 2 + c * (CAP_W + GAP) + wide / 2;
      const cz = -totalD / 2 + r * (CAP_D + GAP) + CAP_D / 2;
      caps.push(
        <mesh key={`${r}-${c}`} position={[cx, CAP_H / 2 + 0.006, cz]}>
          <boxGeometry args={[wide - 0.001, CAP_H, CAP_D - 0.001]} />
          <meshStandardMaterial color={INK_FAINT} roughness={0.75} metalness={0.05} />
        </mesh>,
      );
    }
  }

  return (
    <group position={position}>
      {/* Plate */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[totalW + PLATE_PAD, PLATE_H, totalD + PLATE_PAD]} />
        <meshStandardMaterial color={INK_GHOST} roughness={0.6} metalness={0.25} />
      </mesh>
      {/* Lower body, a thin slab under the plate to suggest depth */}
      <mesh position={[0, -BODY_DROP, 0]}>
        <boxGeometry args={[totalW + PLATE_PAD - 0.004, BODY_H, totalD + PLATE_PAD - 0.004]} />
        <meshStandardMaterial color={BG_PANEL_2} roughness={0.7} metalness={0.2} />
      </mesh>
      {caps}
    </group>
  );
}
