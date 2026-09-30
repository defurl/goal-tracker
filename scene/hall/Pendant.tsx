// The pendant over the tree — the hall's key light made visible (design-system/13
// §2, §5). The desk lamp's shade and bulb, hung from a cord: the same metal, the
// same warm lining, the same unlit bulb that bloom catches. The light itself is
// HallScene's; this is only its fitting.

import { BackSide, DoubleSide } from 'three';

import { BG_PANEL, BG_PANEL_2, LAMP_WARM } from '../../lib/style/colors';
import { HALL_HEIGHT } from './HallShell';
import { HALL_KEY_POSITION } from './hallLighting';

const SHADE_RADIUS = 0.2;
/**
 * How far round the sphere the shade reaches: past the equator, so its rim
 * hangs below the bulb and throws the light down onto the tree and the floor
 * (a cut-off near 54° from vertical) instead of across the wall above the
 * band. The desk lamp's shade can stop at the equator; it sits 35 cm over the
 * desk. This one is 2.3 m up. It casts the key light's shadow, which is what
 * makes the cut-off.
 */
const SHADE_SWEEP = Math.PI * 0.7;
const BULB_RADIUS = 0.03;
const CORD_RADIUS = 0.004;

export function Pendant() {
  const [x, y, z] = HALL_KEY_POSITION;
  const cordLength = HALL_HEIGHT + 0.4 - y;
  return (
    <group>
      <mesh position={[x, y + cordLength / 2, z]}>
        <cylinderGeometry args={[CORD_RADIUS, CORD_RADIUS, cordLength, 8]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Shade: a deep dome around the bulb, open below. */}
      <group position={[x, y, z]}>
        <mesh castShadow>
          <sphereGeometry args={[SHADE_RADIUS, 32, 16, 0, Math.PI * 2, 0, SHADE_SWEEP]} />
          <meshStandardMaterial color={BG_PANEL} roughness={0.6} metalness={0.7} side={DoubleSide} />
        </mesh>
        <mesh>
          <sphereGeometry args={[SHADE_RADIUS - 0.003, 32, 16, 0, Math.PI * 2, 0, SHADE_SWEEP]} />
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

      {/* Bulb. Basic, so the light cannot dim the thing that is the light. */}
      <mesh position={[x, y, z]}>
        <sphereGeometry args={[BULB_RADIUS, 16, 16]} />
        <meshBasicMaterial color={LAMP_WARM} toneMapped={false} />
      </mesh>
    </group>
  );
}
