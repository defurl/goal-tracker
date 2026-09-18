// A1.9 — the phone. design-system/04-room-spec.md §5.
//
// Face-down on the desk. In this product the phone is Article Import
// (lib/stores/interaction.ts), not the portfolio's contact card, so the
// flip-to-reveal-an-email behaviour it carried there is deliberately not
// ported. Geometry only for now; the flip belongs with the interaction
// wrapper and the camera focus pose, which come later in the build order.

import { BG_VOID, INK_GHOST } from '../../lib/style/colors';

interface PhoneProps {
  /** Group origin sits at the desk surface, so y = 0. */
  position: [number, number, number];
}

const W = 0.075;
const D = 0.15;
const H = 0.008;

export function Phone({ position }: PhoneProps) {
  return (
    <group position={position} rotation={[0, -0.15, 0]}>
      <group position={[0, H / 2, 0]}>
        {/* Body */}
        <mesh castShadow>
          <boxGeometry args={[W, H, D]} />
          <meshStandardMaterial color={BG_VOID} roughness={0.25} metalness={0.5} />
        </mesh>

        {/* Camera bump, on the back — which faces up while the phone is down */}
        <mesh position={[W * 0.28, H / 2 + 0.0015, -D * 0.32]}>
          <boxGeometry args={[0.018, 0.003, 0.018]} />
          <meshStandardMaterial color={INK_GHOST} roughness={0.3} metalness={0.65} />
        </mesh>

        {/* Screen, face down against the desk */}
        <mesh position={[0, -H / 2 - 0.0005, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W - 0.006, D - 0.006]} />
          <meshStandardMaterial color={BG_VOID} roughness={0.9} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}
