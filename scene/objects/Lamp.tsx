// A1.4 — the desk lamp. design-system/04-room-spec.md §5, lamp-shape spec in
// `lighting-plan.svg`.
//
// Banker's-lamp form: an open-bottom hemisphere shade on an articulated arm
// rising from a weighted base, with the bulb mesh dangling inside the shade
// rim. The shade is open at the bottom because the lamp is the room's only
// shadow-caster (non-negotiable 2) — a closed sphere would swallow the pool of
// light the acceptance test's first criterion measures.
//
// `SphereGeometry` with `thetaStart = 0, thetaLength = PI/2` is the UPPER
// half-sphere: a dome whose rim (the flat equatorial circle) faces DOWN. The
// bulb sits just inside that opening. The inside surface is a separate
// warm-emissive material so the dome reflects bounce light instead of reading
// as a black cap.
//
// Sized for a ~15 cm shade, ~30 cm arm, ~10 cm base.

import { BackSide, DoubleSide } from 'three';

import { BG_PANEL, BG_PANEL_2, LAMP_WARM } from '../../lib/style/colors';

interface LampProps {
  /** Base position; the base sits on the desk top, so y = 0. */
  position: [number, number, number];
  /** World position of the bulb. Must equal LAMP_POSITION or the light and the
   *  mesh it appears to come from drift apart. */
  bulbPosition: [number, number, number];
}

const BASE_RADIUS = 0.05;
const BASE_HEIGHT = 0.02;
const ARM_RADIUS = 0.005;
const SHADE_RADIUS = 0.075;
const BULB_RADIUS = 0.015;

/** Forward tilt on the shade, aiming the opening at the keyboard zone. */
const SHADE_TILT_X = -0.18;

export function Lamp({ position, bulbPosition }: LampProps) {
  // The arm is one straight cylinder from the base top to the bulb. Deriving
  // its length and tilt from the two endpoints keeps the top end ON the bulb
  // whatever LAMP_POSITION becomes; chaining rotations instead is what
  // misaligned this in the source project.
  const baseTop: [number, number, number] = [
    position[0],
    position[1] + BASE_HEIGHT,
    position[2],
  ];
  const dx = bulbPosition[0] - baseTop[0];
  const dy = bulbPosition[1] - baseTop[1];
  const dz = bulbPosition[2] - baseTop[2];
  const armLength = Math.hypot(dx, dy, dz);

  // A cylinder points along +Y by default. Tilt it so the top end lands on the
  // bulb, then place it at the midpoint of the two endpoints.
  const tiltX = Math.atan2(dz, dy);
  const tiltZ = -Math.atan2(dx, dy);
  const armMid: [number, number, number] = [
    (baseTop[0] + bulbPosition[0]) / 2,
    (baseTop[1] + bulbPosition[1]) / 2,
    (baseTop[2] + bulbPosition[2]) / 2,
  ];

  return (
    <>
      {/* Weighted base */}
      <mesh castShadow position={[position[0], position[1] + BASE_HEIGHT / 2, position[2]]}>
        <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS * 1.08, BASE_HEIGHT, 32]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.6} metalness={0.7} />
      </mesh>

      {/* Arm */}
      <mesh castShadow position={armMid} rotation={[tiltX, 0, tiltZ]}>
        <cylinderGeometry args={[ARM_RADIUS, ARM_RADIUS, armLength, 12]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.6} metalness={0.7} />
      </mesh>

      {/* Shade. The dome runs up from the rim at bulb height to
          bulbY + SHADE_RADIUS. */}
      <group position={bulbPosition} rotation={[SHADE_TILT_X, 0, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[SHADE_RADIUS, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={BG_PANEL}
            roughness={0.6}
            metalness={0.7}
            side={DoubleSide}
          />
        </mesh>
        {/* Inside surface, a hair smaller so it does not z-fight the outside. */}
        <mesh>
          <sphereGeometry args={[SHADE_RADIUS - 0.002, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={BG_PANEL_2}
            emissive={LAMP_WARM}
            emissiveIntensity={0.4}
            roughness={0.55}
            metalness={0.1}
            side={BackSide}
          />
        </mesh>
      </group>

      {/* Bulb. Basic material so scene lighting cannot dim the thing that IS
          the light; bloom picks it up above the 0.1 threshold. */}
      <mesh position={bulbPosition}>
        <sphereGeometry args={[BULB_RADIUS, 16, 16]} />
        <meshBasicMaterial color={LAMP_WARM} toneMapped={false} />
      </mesh>
    </>
  );
}
