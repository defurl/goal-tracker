import { BG_PANEL, BG_PANEL_2, LAMP_WARM } from '../../../lib/style/colors';

// Phase 1 revision — banker's-lamp form per `lighting-plan.svg` lamp-shape spec:
// open-bottom hemisphere shade (NOT a closed sphere), articulated arm rising
// from a weighted base, bulb mesh dangling inside the shade rim, PointLight
// position coincident with the bulb so the light actually spills downward.
//
// Geometry is sized for ~15cm shade radius / ~30cm arm length / ~10cm base.
// The hemisphere is open at the bottom because three.js `SphereGeometry` with
// `thetaStart=0, thetaLength=PI/2` returns the upper half-sphere — that's a
// dome with the rim (the flat equatorial circle) facing DOWN. The bulb sits
// just inside that rim opening; the inside surface of the dome is rendered
// with a separate warm-emissive material so it reflects bounce light.

interface LampProps {
  /** Base position on the desk surface (lamp base sits at y ~= 0). */
  position: [number, number, number];
  /** World-space coordinate of the bulb / PointLight — must match LAMP_POSITION. */
  bulbPosition: [number, number, number];
}

const BASE_RADIUS = 0.05;
const BASE_HEIGHT = 0.02;
const ARM_RADIUS = 0.005;
const SHADE_RADIUS = 0.075;
const BULB_RADIUS = 0.015;

export function Lamp({ position, bulbPosition }: LampProps) {
  // Arm rises from the base (y = BASE_HEIGHT, local) to the shade rim near the
  // bulb's world position. We compute the world-space arm endpoint and derive
  // the cylinder length + tilt rather than chaining rotations (which is what
  // misaligned the previous attempt).
  const baseTopWorld: [number, number, number] = [position[0], position[1] + BASE_HEIGHT, position[2]];
  const dx = bulbPosition[0] - baseTopWorld[0];
  const dy = bulbPosition[1] - baseTopWorld[1];
  const dz = bulbPosition[2] - baseTopWorld[2];
  const armLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // Cylinder default points along +Y. Tilt it so its top end lands at the bulb.
  const tiltX = Math.atan2(dz, dy); // rotation around X (forward/back lean)
  const tiltZ = -Math.atan2(dx, dy); // rotation around Z (left/right lean)
  // Midpoint of arm in world space
  const armMid: [number, number, number] = [
    (baseTopWorld[0] + bulbPosition[0]) / 2,
    (baseTopWorld[1] + bulbPosition[1]) / 2,
    (baseTopWorld[2] + bulbPosition[2]) / 2,
  ];

  return (
    <>
      {/* Base — weighted disc on the desk */}
      <mesh castShadow position={[position[0], position[1] + BASE_HEIGHT / 2, position[2]]}>
        <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS * 1.08, BASE_HEIGHT, 32]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.6} metalness={0.7} />
      </mesh>

      {/* Arm — single straight cylinder from base top to the bulb position */}
      <mesh castShadow position={armMid} rotation={[tiltX, 0, tiltZ]}>
        <cylinderGeometry args={[ARM_RADIUS, ARM_RADIUS, armLength, 12]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.6} metalness={0.7} />
      </mesh>

      {/* Shade — OPEN-BOTTOM hemisphere centered on the bulb. The dome surface
          extends UP from y=bulbY (rim) to y=bulbY+SHADE_RADIUS (top). Slight
          forward tilt aims the opening at the keyboard/notebook zone. */}
      <group position={bulbPosition} rotation={[-0.18, 0, 0]}>
        {/* Outside surface */}
        <mesh castShadow>
          <sphereGeometry args={[SHADE_RADIUS, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={BG_PANEL} roughness={0.6} metalness={0.7} side={2} />
        </mesh>
        {/* Inside surface — slightly smaller, warm emissive so the bounce
            light visible in the reference image reads correctly. */}
        <mesh>
          <sphereGeometry args={[SHADE_RADIUS - 0.002, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={BG_PANEL_2}
            emissive={LAMP_WARM}
            emissiveIntensity={0.4}
            roughness={0.55}
            metalness={0.1}
            side={1}
          />
        </mesh>
      </group>

      {/* Bulb — small sphere at the bulb position. MeshBasicMaterial keeps it
          unaffected by scene lighting; bloom picks it up. */}
      <mesh position={bulbPosition}>
        <sphereGeometry args={[BULB_RADIUS, 16, 16]} />
        <meshBasicMaterial color={LAMP_WARM} toneMapped={false} />
      </mesh>
    </>
  );
}
