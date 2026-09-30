// The hall's shell (design-system/13 §2): the floor, the history wall, the left
// wall with the doorway back to the room, and the right wall with the
// clerestory. y = 0 is the hall floor. As in the room, only what the camera sees
// is built — no ceiling, no front wall (07: the camera never looks up or back).
//
// The left wall has thickness, the others do not: the camera looks along the
// doorway's jambs, and a plane there would show as a paper edge.

import { ConcreteMaterial } from '../objects/RoomShell';
import { INK_GHOST } from '../../lib/style/colors';

export const HALL_WALL_Z = -1.5;
export const HALL_WALL_WIDTH = 7;
export const HALL_HEIGHT = 3.6;
const LEFT_X = -3.0;
const RIGHT_X = 3.5;
const FRONT_Z = 3.0;
const WALL_T = 0.2;

/** The doorway back to the room, in the left wall (§2, §7). */
export const DOORWAY = { z: -1.0, width: 0.8, height: 2.1 } as const;
/** The clerestory, a tall slot in the right wall. */
export const CLERESTORY = { z: -0.8, width: 0.35, bottom: 0.9, top: 2.5 } as const;

type Box = { key: string; position: [number, number, number]; args: [number, number, number] };
type Plane = { key: string; position: [number, number, number]; args: [number, number] };

const doorBack = DOORWAY.z - DOORWAY.width / 2;
const doorFront = DOORWAY.z + DOORWAY.width / 2;
const LEFT_WALL: Box[] = [
  { key: 'behind', position: [LEFT_X - WALL_T / 2, HALL_HEIGHT / 2, (HALL_WALL_Z + doorBack) / 2], args: [WALL_T, HALL_HEIGHT, doorBack - HALL_WALL_Z] },
  { key: 'front', position: [LEFT_X - WALL_T / 2, HALL_HEIGHT / 2, (doorFront + FRONT_Z) / 2], args: [WALL_T, HALL_HEIGHT, FRONT_Z - doorFront] },
  { key: 'lintel', position: [LEFT_X - WALL_T / 2, (DOORWAY.height + HALL_HEIGHT) / 2, DOORWAY.z], args: [WALL_T, HALL_HEIGHT - DOORWAY.height, DOORWAY.width] },
];

const slotBack = CLERESTORY.z - CLERESTORY.width / 2;
const slotFront = CLERESTORY.z + CLERESTORY.width / 2;
const RIGHT_WALL: Plane[] = [
  { key: 'behind', position: [RIGHT_X, HALL_HEIGHT / 2, (HALL_WALL_Z + slotBack) / 2], args: [slotBack - HALL_WALL_Z, HALL_HEIGHT] },
  { key: 'front', position: [RIGHT_X, HALL_HEIGHT / 2, (slotFront + FRONT_Z) / 2], args: [FRONT_Z - slotFront, HALL_HEIGHT] },
  { key: 'above', position: [RIGHT_X, (CLERESTORY.top + HALL_HEIGHT) / 2, CLERESTORY.z], args: [CLERESTORY.width, HALL_HEIGHT - CLERESTORY.top] },
  { key: 'below', position: [RIGHT_X, CLERESTORY.bottom / 2, CLERESTORY.z], args: [CLERESTORY.width, CLERESTORY.bottom] },
];

/** The back wall's Ando joints (04), 2 mm proud: three panels high, four across. */
const JOINTS: { position: [number, number, number]; size: [number, number, number] }[] = [
  { position: [0, HALL_HEIGHT / 3, HALL_WALL_Z + 0.002], size: [HALL_WALL_WIDTH, 0.005, 0.005] },
  { position: [0, (2 * HALL_HEIGHT) / 3, HALL_WALL_Z + 0.002], size: [HALL_WALL_WIDTH, 0.005, 0.005] },
  { position: [-1.75, HALL_HEIGHT / 2, HALL_WALL_Z + 0.002], size: [0.005, HALL_HEIGHT, 0.005] },
  { position: [0, HALL_HEIGHT / 2, HALL_WALL_Z + 0.002], size: [0.005, HALL_HEIGHT, 0.005] },
  { position: [1.75, HALL_HEIGHT / 2, HALL_WALL_Z + 0.002], size: [0.005, HALL_HEIGHT, 0.005] },
];

export function HallShell() {
  return (
    <group>
      {/* Floor — 10 x 10 so its edges never enter frame. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[10, 10]} />
        <ConcreteMaterial />
      </mesh>

      {/* The history wall (§4 sets its cells into it). */}
      <mesh receiveShadow position={[0, HALL_HEIGHT / 2, HALL_WALL_Z]}>
        <planeGeometry args={[HALL_WALL_WIDTH, HALL_HEIGHT]} />
        <ConcreteMaterial />
      </mesh>
      {JOINTS.map((joint, i) => (
        <mesh key={`joint-${i}`} position={joint.position}>
          <boxGeometry args={joint.size} />
          <meshStandardMaterial color={INK_GHOST} roughness={0.9} metalness={0} />
        </mesh>
      ))}

      {/* Left wall, around the doorway. */}
      {LEFT_WALL.map(({ key, position, args }) => (
        <mesh key={`left-${key}`} receiveShadow castShadow position={position}>
          <boxGeometry args={args} />
          <ConcreteMaterial />
        </mesh>
      ))}
      {/* Beyond the doorway: the passage back to the room, lit by the spill.
          Two metres out, so the light reads as coming from somewhere past it
          rather than as a lit panel in the opening. */}
      <mesh receiveShadow position={[LEFT_X - 2.0, HALL_HEIGHT / 2, DOORWAY.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[3.0, HALL_HEIGHT]} />
        <ConcreteMaterial />
      </mesh>

      {/* Right wall, around the clerestory. Normal faces -X, into the hall. */}
      {RIGHT_WALL.map(({ key, position, args }) => (
        <mesh key={`right-${key}`} receiveShadow position={position} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={args} />
          <ConcreteMaterial />
        </mesh>
      ))}
    </group>
  );
}
