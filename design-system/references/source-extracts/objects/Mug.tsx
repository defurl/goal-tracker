import { BG_VOID, INK_PAPER } from '../../../lib/style/colors';

// Phase 1.6 — coffee mug. Slight taper toward the base, dark exterior,
// paper-toned interior so the lamp catches the rim. ~85mm tall, ~78mm wide.
// Steam optional (P2 — not in v1).

interface MugProps {
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
      {/* Inner liner — paper-toned, slightly inset, gives a warm catch at the rim. */}
      <mesh position={[0, HEIGHT / 2 + 0.001, 0]}>
        <cylinderGeometry args={[TOP_R - 0.004, BOT_R - 0.004, HEIGHT - 0.002, 32, 1, true]} />
        <meshStandardMaterial color={INK_PAPER} roughness={0.7} metalness={0} side={2} />
      </mesh>
      {/* Handle — a half-torus on the −X side. After the +π/2 Z rotation
          the arc's two cut ends sit vertically (above & below) and meet
          the mug body at the rim, with the bulge arcing OUTWARD (−X)
          away from the cup. (The prior −π/2 rotation flipped this — the
          ends pointed into open space and the bulge poked into the body.) */}
      <mesh position={[-TOP_R, HEIGHT / 2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.022, 0.006, 12, 24, Math.PI]} />
        <meshStandardMaterial color={BG_VOID} roughness={0.4} metalness={0.15} />
      </mesh>
    </group>
  );
}
