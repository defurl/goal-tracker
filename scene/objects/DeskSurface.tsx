// A1.3 — the desk. design-system/04-room-spec.md §4.
//
// 2.0 x 0.9 x 0.04 m top, 0.74 m above the floor on four legs, centred at
// z = -0.15 so it spans z = -0.6 .. +0.3. Width is 2.0 m (not 1.8) so the lamp
// at x = -0.95 sits ON the desk.
//
// The walnut and brass hex literals below are the ONLY two sanctioned literals
// outside the token palette in the whole room (01-color-palette.md). They are
// deliberate warm-wood exceptions and they are already spent — `lint:colors`
// allows them here and nowhere else. Do not add a third.

import { BG_PANEL, INK_GHOST } from '../../lib/style/colors';

const WIDTH = 2.0;
const DEPTH = 0.9;
const TOP_THICKNESS = 0.04;
const LEG_RADIUS = 0.025;
const LEG_INSET = 0.06;

const FLOOR_Y = -0.74;
const LEG_TOP = -TOP_THICKNESS;
const LEG_LENGTH = LEG_TOP - FLOOR_Y;
const LEG_CENTER_Y = (LEG_TOP + FLOOR_Y) / 2;

const LEG_X = WIDTH / 2 - LEG_INSET; // +/- 0.94
const LEG_Z_BACK = -DEPTH / 2 + LEG_INSET; // -0.39
const LEG_Z_FRONT = DEPTH / 2 - LEG_INSET; // +0.39

/** Desk centre in Z. The top spans z = -0.6 .. +0.3. */
const TOP_Z = -DEPTH / 2 + 0.3;

const LEG_POSITIONS: [number, number][] = [
  [-LEG_X, TOP_Z + LEG_Z_BACK],
  [LEG_X, TOP_Z + LEG_Z_BACK],
  [-LEG_X, TOP_Z + LEG_Z_FRONT],
  [LEG_X, TOP_Z + LEG_Z_FRONT],
];

const DRAWER_Y = -TOP_THICKNESS - 0.075;
const DRAWER_DEPTH = DEPTH - 0.06;
const DRAWER_FACE_Z = TOP_Z + DRAWER_DEPTH / 2;

export function DeskSurface() {
  return (
    <group>
      {/* Top. Casts onto the floor, receives from everything standing on it. */}
      <mesh castShadow receiveShadow position={[0, -TOP_THICKNESS / 2, TOP_Z]}>
        <boxGeometry args={[WIDTH, TOP_THICKNESS, DEPTH]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Legs — dark-metal coded, y-centred between the top's underside and the floor. */}
      {LEG_POSITIONS.map(([x, z], i) => (
        <mesh key={`leg-${i}`} castShadow position={[x, LEG_CENTER_Y, z]}>
          <cylinderGeometry args={[LEG_RADIUS, LEG_RADIUS, LEG_LENGTH, 16]} />
          <meshStandardMaterial color={INK_GHOST} roughness={0.4} metalness={0.7} />
        </mesh>
      ))}

      {/* Walnut drawer cabinets with brass handles — the warm undercut. */}
      {[-0.55, 0.55].map((x, i) => (
        <group key={`drawer-${i}`}>
          <mesh castShadow receiveShadow position={[x, DRAWER_Y, TOP_Z]}>
            <boxGeometry args={[0.42, 0.15, DRAWER_DEPTH]} />
            <meshStandardMaterial color="#221811" roughness={0.9} metalness={0.05} />
          </mesh>

          {/* Face panel, proud 5 mm in Z. */}
          <mesh castShadow position={[x, DRAWER_Y, DRAWER_FACE_Z + 0.005]}>
            <boxGeometry args={[0.4, 0.13, 0.015]} />
            <meshStandardMaterial color="#2C1F17" roughness={0.85} metalness={0.05} />
          </mesh>

          <group position={[x, DRAWER_Y, DRAWER_FACE_Z + 0.015]}>
            <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.008, 0.008, 0.12, 12]} />
              <meshStandardMaterial color="#B8860B" roughness={0.25} metalness={0.9} />
            </mesh>
            {[-0.045, 0.045].map((peg, p) => (
              <mesh key={`peg-${p}`} position={[peg, 0, -0.006]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.005, 0.005, 0.012, 8]} />
                <meshStandardMaterial color="#B8860B" roughness={0.3} metalness={0.8} />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}
