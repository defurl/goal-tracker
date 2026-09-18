import { BG_PANEL, INK_PAPER, SIGNAL_AMBER_DIM } from '../../../lib/style/colors';

// Phase 1.6 — closed A4-ish notebook lying flat. Spine on the long edge.
// Paper-toned cover with a thin amber bookmark strip suggests "in use."

interface NotebookProps {
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
      {/* Page block — slightly inset, paper-toned, only visible from the
          long edge opposite the spine. */}
      <mesh position={[0.001, H / 2, D / 2 - 0.002]}>
        <boxGeometry args={[W - 0.012, H - 0.003, 0.004]} />
        <meshStandardMaterial color={INK_PAPER} roughness={0.95} metalness={0} />
      </mesh>
      {/* Bookmark — thin amber strip emerging from the closed top edge */}
      <mesh position={[W / 4, H + 0.0005, D / 4]}>
        <boxGeometry args={[0.006, 0.0008, 0.07]} />
        <meshStandardMaterial color={SIGNAL_AMBER_DIM} roughness={0.6} metalness={0.1} />
      </mesh>
    </group>
  );
}
