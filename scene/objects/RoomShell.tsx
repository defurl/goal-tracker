// A1.1 — floor, back wall, and the right wall as four segments around the
// window opening. Geometry is reproduced exactly from
// design-system/04-room-spec.md §2; change a number only with a reason written
// down next to it.
//
// There is no left wall, no ceiling and no front wall. The room is an open
// three-sided box and the darkness does the rest of the enclosing. Do not
// "complete" the room — the missing walls are why the lamp pool reads as the
// only lit thing in a much bigger dark space.

import { BG_PANEL } from '../../lib/style/colors';

/** y = 0 is the desk top, never the floor. The floor hangs 0.74 m below it. */
export const FLOOR_Y = -0.74;

/** Shared by the floor and every wall segment. */
function ConcreteMaterial() {
  return <meshStandardMaterial color={BG_PANEL} roughness={0.85} metalness={0.05} />;
}

/**
 * Right wall segments, built AROUND a 0.7 x 1.0 m opening centred at
 * (2.0, 1.0, -0.3) rather than as one plane with a hole. z = -0.3 puts the
 * window roughly behind the monitors so it peeks past their right edge.
 * The wall runs forward past the camera (z up to +2.5) so the right edge of
 * frame reads as a real room edge rather than void.
 */
const RIGHT_WALL_SEGMENTS: { key: string; position: [number, number, number]; args: [number, number] }[] = [
  { key: 'behind-window', position: [2.0, 0.51, -0.925], args: [0.55, 2.5] },
  { key: 'in-front-of-window', position: [2.0, 0.51, 1.275], args: [2.45, 2.5] },
  { key: 'above-window', position: [2.0, 1.63, -0.3], args: [0.7, 0.26] },
  { key: 'below-window', position: [2.0, -0.12, -0.3], args: [0.7, 1.24] },
];

export function RoomShell() {
  return (
    <group>
      {/* Floor — 10 x 10 m so its edges never enter frame. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]}>
        <planeGeometry args={[10, 10]} />
        <ConcreteMaterial />
      </mesh>

      {/* Back wall — single solid panel, no cutout. */}
      <mesh receiveShadow position={[0, 0.51, -1.2]}>
        <planeGeometry args={[6, 2.5]} />
        <ConcreteMaterial />
      </mesh>

      {/* Right wall. Rotated so the normal faces -X, toward the camera. */}
      {RIGHT_WALL_SEGMENTS.map(({ key, position, args }) => (
        <mesh key={key} receiveShadow position={position} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={args} />
          <ConcreteMaterial />
        </mesh>
      ))}
    </group>
  );
}
