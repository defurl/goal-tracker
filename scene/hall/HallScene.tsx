// The hall — the scene behind the room's door (design-system/13, build plan
// A5.8). Lights, shell, and the rig that frames them. No DOM in this file.
//
// Five light roles, six instances, as the room: KEY (the pendant), FILL ×2 (the
// wall's uplights), RIM (the clerestory), DOOR SPILL (the room through the
// doorway), AMBIENT. **Do not add a light.** Balanced against the hall's own
// acceptance test (13 §5).
//
// Its own chunk, loaded when the room's door is first hovered or armed
// (scene/hall/load.ts), never with the room (10-tech-stack: "do not preload a
// deep scene from the entry scene").

import { useMemo } from 'react';
import { Object3D } from 'three';

import { useInteractionStore } from '../../lib/stores/interaction';
import { BG_NIGHT, GLOW_COOL, LAMP_WARM } from '../../lib/style/colors';
import { CameraRig } from '../CameraRig';
import { InteractiveObject } from '../InteractiveObject';
import { Bonsai } from '../objects/Bonsai';
import { Effects } from '../Effects';
import { HALL_REST_POSE } from '../cameraPoses';
import { SkyPlane } from '../objects/SkyPlane';
import { WindowRim } from '../WindowRim';
import { CLERESTORY, HallShell } from './HallShell';
import { HistoryWall } from './HistoryWall';
import { Pendant } from './Pendant';
import {
  HALL_AMBIENT_INTENSITY,
  HALL_FILL_ANGLE,
  HALL_FILL_DECAY,
  HALL_FILL_DISTANCE,
  HALL_FILL_INTENSITY,
  HALL_FILL_PENUMBRA,
  HALL_FILL_POSITIONS,
  HALL_FILL_TARGETS,
  HALL_KEY_DECAY,
  HALL_KEY_DISTANCE,
  HALL_KEY_INTENSITY,
  HALL_KEY_POSITION,
  HALL_RIM_POSITION,
  HALL_RIM_SCALE,
  HALL_RIM_TARGET,
  HALL_SHADOW_BIAS,
  HALL_SHADOW_MAP,
  HALL_SHADOW_NEAR,
  HALL_SPILL_DECAY,
  HALL_SPILL_DISTANCE,
  HALL_SPILL_INTENSITY,
  HALL_SPILL_POSITION,
} from './hallLighting';

type Vec3 = [number, number, number];

/**
 * The full-size tree (13 §3): the desk's bonsai, the same leaves in the same
 * places, at five times its scale — the top pad about 1.3 m up. It shows the
 * leaves earned at the desk and grows none here.
 */
const TREE_POSITION: Vec3 = [-0.6, 0, 0.2];
const TREE_SCALE = 4.4;
const vec = (v: readonly number[]) => v as unknown as Vec3;

function target(position: readonly number[]): Object3D {
  const object = new Object3D();
  object.position.set(...vec(position));
  return object;
}

export default function HallScene() {
  const focusObject = useInteractionStore((s) => s.focusObject);
  const fillTargets = useMemo(() => HALL_FILL_TARGETS.map(target), []);
  const rimTarget = useMemo(() => target(HALL_RIM_TARGET), []);

  return (
    <>
      <ambientLight color={BG_NIGHT} intensity={HALL_AMBIENT_INTENSITY} />

      {/* KEY — the pendant. The sole shadow-caster. */}
      <pointLight
        position={vec(HALL_KEY_POSITION)}
        color={LAMP_WARM}
        intensity={HALL_KEY_INTENSITY}
        distance={HALL_KEY_DISTANCE}
        decay={HALL_KEY_DECAY}
        castShadow
        shadow-mapSize-width={HALL_SHADOW_MAP}
        shadow-mapSize-height={HALL_SHADOW_MAP}
        shadow-bias={HALL_SHADOW_BIAS}
        shadow-camera-near={HALL_SHADOW_NEAR}
      />

      {/* FILL ×2 — the history wall washed from the floor. */}
      {HALL_FILL_POSITIONS.map((position, i) => (
        <group key={`fill-${i}`}>
          <primitive object={fillTargets[i] as Object3D} />
          <spotLight
            position={vec(position)}
            target={fillTargets[i]}
            color={GLOW_COOL}
            intensity={HALL_FILL_INTENSITY}
            distance={HALL_FILL_DISTANCE}
            decay={HALL_FILL_DECAY}
            angle={HALL_FILL_ANGLE}
            penumbra={HALL_FILL_PENUMBRA}
          />
        </group>
      ))}

      {/* RIM — the clerestory, following the hour as the room's window does. */}
      <primitive object={rimTarget} />
      <WindowRim target={rimTarget} position={HALL_RIM_POSITION} scale={HALL_RIM_SCALE} />

      {/* DOOR SPILL — the room, through the doorway you came in by. */}
      <pointLight
        position={vec(HALL_SPILL_POSITION)}
        color={LAMP_WARM}
        intensity={HALL_SPILL_INTENSITY}
        distance={HALL_SPILL_DISTANCE}
        decay={HALL_SPILL_DECAY}
      />

      <HallShell />
      <Pendant />
      {/* Glide only (13 §3, §9): the camera looks up into the canopy. */}
      <InteractiveObject
        id="hallTree"
        label="the tree"
        labelPosition={[TREE_POSITION[0], 1.6, TREE_POSITION[2]]}
        onActivate={() => focusObject('hallTree', null)}
      >
        <Bonsai position={TREE_POSITION} scale={TREE_SCALE} grows={false} />
      </InteractiveObject>
      {/* The history wall (13 §4): glide + the history panel. */}
      <InteractiveObject
        id="hallWall"
        label="the year"
        labelPosition={[0, 1.62, -1.45]}
        onActivate={() => focusObject('hallWall', 'history')}
      >
        <HistoryWall />
      </InteractiveObject>
      {/* The clerestory's sky, just outside the right wall's slot: the room's
          sky by the hour, at a fifth of its strength. It is in the rest frame
          and bare, where the room's window is out of it and behind glass; at
          full day strength it outshone the tree's pool (13 §5, measured). */}
      <SkyPlane
        position={[3.8, (CLERESTORY.bottom + CLERESTORY.top) / 2, CLERESTORY.z]}
        rotation={[0, -Math.PI / 2, 0]}
        size={[CLERESTORY.width, CLERESTORY.top - CLERESTORY.bottom]}
        scale={0.2}
      />

      <CameraRig rest={HALL_REST_POSE} restMobile={HALL_REST_POSE} />
      <Effects />
    </>
  );
}
