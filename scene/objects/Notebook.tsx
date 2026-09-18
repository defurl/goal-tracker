// A1.8 — the notebook. design-system/04-room-spec.md §5.
//
// Closed, lying flat, spine on the long edge. The page block shows only on the
// edge opposite the spine, and a thin bookmark strip says "in use" without
// needing the book open.
//
// The bookmark is SIGNAL_DIM but has no emissive channel, so it carries no
// bloom obligation — it is lit by the lamp like everything else on the desk.

import { BG_PANEL, INK_PAPER, SIGNAL_DIM } from '../../lib/style/colors';

interface NotebookProps {
  /** Group origin sits at the desk surface, so y = 0. */
  position: [number, number, number];
}

const W = 0.18;
const D = 0.245;
const H = 0.014;

export function Notebook({ position }: NotebookProps) {
  return (
    <group position={position} rotation={[0, 0.18, 0]}>
      {/* Cover */}
      <mesh castShadow position={[0, H / 2, 0]}>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.88} metalness={0.02} />
      </mesh>

      {/* Page block, inset so it only reads from the open edge */}
      <mesh position={[0.001, H / 2, D / 2 - 0.002]}>
        <boxGeometry args={[W - 0.012, H - 0.003, 0.004]} />
        <meshStandardMaterial color={INK_PAPER} roughness={0.95} metalness={0} />
      </mesh>

      {/* Bookmark */}
      <mesh position={[W / 4, H + 0.0005, D / 4]}>
        <boxGeometry args={[0.006, 0.0008, 0.07]} />
        <meshStandardMaterial color={SIGNAL_DIM} roughness={0.6} metalness={0.1} />
      </mesh>
    </group>
  );
}
