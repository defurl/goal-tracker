// A1.7 — the coffee mug. design-system/04-room-spec.md §5.
//
// Dark exterior with a paper-toned liner, so the lamp catches the rim and the
// mug reads as an open vessel rather than a dark cylinder. ~85 mm tall.
// Steam is a P2 idea and is deliberately not here.

import { DoubleSide } from 'three';

import { BG_VOID, INK_PAPER } from '../../lib/style/colors';

interface MugProps {
  /** Group origin sits at the base, so y = 0 stands it on the desk. */
  position: [number, number, number];
}

const HEIGHT = 0.085;
const TOP_R = 0.038;
const BOT_R = 0.032;

export function Mug({ position }: MugProps) {
  return (
    <group position={position}>
      {/* Body */}
      <mesh castShadow position={[0, HEIGHT / 2, 0]}>
        <cylinderGeometry args={[TOP_R, BOT_R, HEIGHT, 32, 1, false]} />
        <meshStandardMaterial color={BG_VOID} roughness={0.35} metalness={0.15} />
      </mesh>

      {/* Liner, inset and open-ended, for the warm catch at the rim */}
      <mesh position={[0, HEIGHT / 2 + 0.001, 0]}>
        <cylinderGeometry args={[TOP_R - 0.004, BOT_R - 0.004, HEIGHT - 0.002, 32, 1, true]} />
        <meshStandardMaterial color={INK_PAPER} roughness={0.7} metalness={0} side={DoubleSide} />
      </mesh>

      {/* Handle. After the +PI/2 Z rotation the half-torus's cut ends sit
          vertically against the body and the bulge arcs outward on -X; the
          opposite rotation puts the bulge inside the mug. */}
      <mesh position={[-TOP_R, HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.022, 0.006, 12, 24, Math.PI]} />
        <meshStandardMaterial color={BG_VOID} roughness={0.4} metalness={0.15} />
      </mesh>
    </group>
  );
}
