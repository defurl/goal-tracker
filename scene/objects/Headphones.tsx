// A1.10 — the headphones. design-system/04-room-spec.md §5.
//
// Two earcups and a thin arched band, lying flat on the desk: cups face up,
// band arcing back between them. Recognisable in silhouette is the whole goal
// — no cushions, no drivers, no cable.
//
// The band is a half-torus. A torus is built in the XY plane, so the -PI/2
// rotation about X lays the arc down into XZ and points it away from the
// viewer; without it the band stands upright as if worn.

import { DoubleSide } from 'three';

import { BG_VOID, INK_FAINT, INK_GHOST } from '../../lib/style/colors';

interface HeadphonesProps {
  /** Group origin sits at the desk surface, so y = 0. */
  position: [number, number, number];
}

const CUP_R = 0.045;
const CUP_H = 0.028;
const CUP_GAP = 0.14;
const BAND_R = CUP_GAP / 2;

export function Headphones({ position }: HeadphonesProps) {
  return (
    <group position={position}>
      {[-CUP_GAP / 2, CUP_GAP / 2].map((x, i) => (
        <group key={`cup-${i}`} position={[x, CUP_H / 2, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[CUP_R, CUP_R, CUP_H, 24]} />
            <meshStandardMaterial color={BG_VOID} roughness={0.5} metalness={0.2} />
          </mesh>
          {/* Faint ring for the cushion edge, facing up */}
          <mesh position={[0, CUP_H / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[CUP_R - 0.012, CUP_R - 0.002, 24]} />
            <meshStandardMaterial
              color={INK_FAINT}
              roughness={0.95}
              metalness={0}
              side={DoubleSide}
            />
          </mesh>
        </group>
      ))}

      {/* Band */}
      <mesh position={[0, CUP_H / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BAND_R, 0.005, 8, 24, Math.PI]} />
        <meshStandardMaterial color={INK_GHOST} roughness={0.4} metalness={0.6} />
      </mesh>
    </group>
  );
}
