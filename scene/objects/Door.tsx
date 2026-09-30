// The door — the room's warm floor spill, made a way through (design-system/13
// §7, 08-interaction-grammar §4: "transition: the door (invisible floor disc) —
// full scene change behind a fade"). The portfolio's precedent: a transparent
// disc on the spill, labelled "step through".
//
// "The door is not geometry" (04): the disc is invisible, and the light that
// always implied a space off-frame now leads to it.
//
// Hovering it (or arming it on a phone) fetches the hall's chunk, so the swap
// is ready by the time the glide lands. Offline, the hall opens only if that
// chunk is already here; otherwise the label says so and nothing happens.

import { useEffect } from 'react';

import { enterHall } from '../../lib/scene/transition';
import { useAppStore } from '../../lib/stores/app';
import { useInteractionStore } from '../../lib/stores/interaction';
import { InteractiveObject } from '../InteractiveObject';
import { hallLoaded, loadHall } from '../hall/load';
import { FLOOR_Y } from './RoomShell';

/** On the spill's warm rectangle (04: [-1.0, -0.73, 0.3]), a hair above the floor. */
const DISC: [number, number, number] = [-1.0, FLOOR_Y + 0.01, 0.3];

export function Door() {
  const offline = useAppStore((s) => s.offline);
  const hovered = useInteractionStore((s) => s.hovered === 'door');

  useEffect(() => {
    if (hovered) void loadHall().catch(() => undefined);
  }, [hovered]);

  const unreachable = offline && !hallLoaded();

  return (
    <InteractiveObject
      id="door"
      label={unreachable ? 'the hall needs a connection' : 'step through'}
      labelPosition={[DISC[0], 0.05, DISC[2]]}
      onActivate={unreachable ? undefined : () => void enterHall()}
    >
      <mesh position={DISC} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </InteractiveObject>
  );
}
