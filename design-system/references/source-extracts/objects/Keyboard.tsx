import { BG_PANEL_2, INK_FAINT, INK_GHOST } from '../../../lib/style/colors';
import { useSceneStore } from '../../../lib/stores/sceneStore';

// Phase 1.6 — mechanical keyboard, TKL, very low profile.
// The keycaps are 60 hand-placed tiny rounded boxes; recognizable as a
// keyboard in silhouette without going for realism. PBT-coded muted caps,
// no legends (legends at this scale would be illegible noise).
//
// Layout: 14 cols × 5 rows. Mobile (1.21) collapses to 8×3 — same
// silhouette, far fewer draw calls.
const COLS_DESKTOP = 14;
const ROWS_DESKTOP = 5;
const COLS_MOBILE = 8;
const ROWS_MOBILE = 3;
const CAP_W = 0.022;
const CAP_D = 0.022;
const CAP_H = 0.010;
const GAP = 0.0035;
const PLATE_PAD = 0.02;

interface KeyboardProps {
  position: [number, number, number];
}

export function Keyboard({ position }: KeyboardProps) {
  const isMobile = useSceneStore(s => s.isMobile);
  const COLS = isMobile ? COLS_MOBILE : COLS_DESKTOP;
  const ROWS = isMobile ? ROWS_MOBILE : ROWS_DESKTOP;
  const totalW = COLS * CAP_W + (COLS - 1) * GAP;
  const totalD = ROWS * CAP_D + (ROWS - 1) * GAP;
  const caps: JSX.Element[] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Skip a couple of slots on the bottom row to read as a spacebar gap.
      const isBottomRow = r === ROWS - 1;
      const isSpaceArea = isBottomRow && c >= 4 && c <= 9;
      if (isSpaceArea && c !== 4) continue; // single wide cap rendered next
      const wide = isSpaceArea ? CAP_W * 6 + GAP * 5 : CAP_W;
      const cx = -totalW / 2 + c * (CAP_W + GAP) + wide / 2;
      const cz = -totalD / 2 + r * (CAP_D + GAP) + CAP_D / 2;
      caps.push(
        <mesh key={`${r}-${c}`} position={[cx, CAP_H / 2 + 0.006, cz]}>
          <boxGeometry args={[wide - 0.001, CAP_H, CAP_D - 0.001]} />
          <meshStandardMaterial color={INK_FAINT} roughness={0.75} metalness={0.05} />
        </mesh>,
      );
      if (isSpaceArea) break; // only one big cap for the space area
    }
  }

  return (
    <group position={position}>
      {/* Plate */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[totalW + PLATE_PAD, 0.012, totalD + PLATE_PAD]} />
        <meshStandardMaterial color={INK_GHOST} roughness={0.6} metalness={0.25} />
      </mesh>
      {/* Lower body (thin slab under the plate to suggest depth) */}
      <mesh position={[0, -0.008, 0]}>
        <boxGeometry args={[totalW + PLATE_PAD - 0.004, 0.006, totalD + PLATE_PAD - 0.004]} />
        <meshStandardMaterial color={BG_PANEL_2} roughness={0.7} metalness={0.2} />
      </mesh>
      {caps}
    </group>
  );
}
