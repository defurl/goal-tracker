import { BG_VOID, INK_FAINT, INK_GHOST } from '../../../lib/style/colors';

// Phase 1.6 — over-ear headphones resting flat on the desk.
// Two earcups + a thin arched band. Recognizable in silhouette is the
// only goal; we don't model cushions, drivers, or cables.

interface HeadphonesProps {
  position: [number, number, number];
}

const CUP_R = 0.045;
const CUP_H = 0.028;
const CUP_GAP = 0.14;
const BAND_R = CUP_GAP / 2;

export function Headphones({ position }: HeadphonesProps) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      {/* Earcups */}
      {[-CUP_GAP / 2, CUP_GAP / 2].map((x, i) => (
        <group key={`cup-${i}`} position={[x, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[CUP_R, CUP_R, CUP_H, 24]} />
            <meshStandardMaterial color={BG_VOID} roughness={0.5} metalness={0.2} />
          </mesh>
          {/* Inner pad — faint ring inset to suggest the cushion edge */}
          <mesh position={[0, CUP_H / 2 + 0.001, 0]}>
            <ringGeometry args={[CUP_R - 0.012, CUP_R - 0.002, 24]} />
            <meshStandardMaterial color={INK_FAINT} roughness={0.95} metalness={0} side={2} />
          </mesh>
        </group>
      ))}

      {/* Band — half-torus arching between the two cups */}
      <mesh position={[0, CUP_H * 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BAND_R, 0.005, 8, 24, Math.PI]} />
        <meshStandardMaterial color={INK_GHOST} roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}
