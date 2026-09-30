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
 * Where the window opening is centred along the right wall. 04-room-spec §2
 * puts it at z = -0.3 so the window "peeks past the monitors' right edge", but
 * from this room's rest pose (07-camera, FOV 50) that left the window ~2°
 * outside the frame at 16:10. At -0.6 the back half of the window shows at the
 * lower right edge and the front edge is just clipped: it peeks. Owner decision
 * 2026-09-30, D-23 §11. The camera stays exactly as 07 specifies. The window
 * rim light already sits at z = -0.6 (lighting.ts).
 */
export const WINDOW_Z = -0.6;
const OPENING_W = 0.7;
const WALL_BACK = -1.2;
const WALL_FRONT = 2.5;

/**
 * Right wall segments, built AROUND a 0.7 x 1.0 m opening centred at
 * (2.0, 1.0, WINDOW_Z) rather than as one plane with a hole. The wall runs
 * forward past the camera (z up to +2.5) so the right edge of frame reads as a
 * real room edge rather than void.
 */
const OPENING_BACK = WINDOW_Z - OPENING_W / 2;
const OPENING_FRONT = WINDOW_Z + OPENING_W / 2;
const RIGHT_WALL_SEGMENTS: { key: string; position: [number, number, number]; args: [number, number] }[] = [
  {
    key: 'behind-window',
    position: [2.0, 0.51, (WALL_BACK + OPENING_BACK) / 2],
    args: [OPENING_BACK - WALL_BACK, 2.5],
  },
  {
    key: 'in-front-of-window',
    position: [2.0, 0.51, (OPENING_FRONT + WALL_FRONT) / 2],
    args: [WALL_FRONT - OPENING_FRONT, 2.5],
  },
  { key: 'above-window', position: [2.0, 1.63, WINDOW_Z], args: [OPENING_W, 0.26] },
  { key: 'below-window', position: [2.0, -0.12, WINDOW_Z], args: [OPENING_W, 1.24] },
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
