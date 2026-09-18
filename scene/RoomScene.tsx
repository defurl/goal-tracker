// The room: lights + objects + rig. No DOM in this file.
//
// Five light roles, six instances (the fill is a matched pair). That is the
// whole rig and it is balanced against the acceptance test in
// design-system/05-lighting-rig.md §4. **Do not add a light.**

import { useMemo } from 'react';
import { Object3D } from 'three';
import {
  AMBIENT_INTENSITY,
  DOOR_SPILL_DECAY,
  DOOR_SPILL_DISTANCE,
  DOOR_SPILL_INTENSITY,
  DOOR_SPILL_POSITION,
  LAMP_DECAY,
  LAMP_DISTANCE,
  LAMP_INTENSITY,
  LAMP_POSITION,
  LAMP_SHADOW_BIAS,
  LAMP_SHADOW_MAP,
  MONITOR_FILL_ANGLE,
  MONITOR_FILL_DECAY,
  MONITOR_FILL_DISTANCE,
  MONITOR_FILL_INTENSITY,
  MONITOR_FILL_PENUMBRA,
  MONITOR_FILL_POSITIONS,
  MONITOR_FILL_TARGETS,
  WINDOW_RIM_INTENSITY,
  WINDOW_RIM_POSITION,
  WINDOW_RIM_TARGET,
} from './lighting';
import { BG_NIGHT, GLOW_COOL, GLOW_COOL_SOFT, LAMP_WARM } from '../lib/style/colors';
import { CameraRig } from './CameraRig';
import { Effects } from './Effects';
import { InteractiveObject } from './InteractiveObject';
import { useInteractionStore } from '../lib/stores/interaction';
import { RoomShell } from './objects/RoomShell';
import { AndoWallDetails } from './objects/AndoWallDetails';
import { DeskSurface } from './objects/DeskSurface';
import { Lamp } from './objects/Lamp';
import { KEYBOARD_DROP, Keyboard } from './objects/Keyboard';
import { Monitor } from './objects/Monitor';
import { Mug } from './objects/Mug';
import { Notebook } from './objects/Notebook';
import { Phone } from './objects/Phone';
import { Headphones } from './objects/Headphones';
import { Window } from './objects/Window';
import { DustMotes } from './objects/DustMotes';

export function RoomScene() {
  const focusObject = useInteractionStore((s) => s.focusObject);
  // Spot lights aim at an Object3D, so the targets must be stable across
  // renders and mounted into the graph with <primitive>.
  const fillTargets = useMemo(
    () =>
      MONITOR_FILL_TARGETS.map((target) => {
        const object = new Object3D();
        // Indices rather than a spread: these constants are `as const`, and TS
        // will not spread a readonly tuple into Vector3.set's fixed parameters.
        object.position.set(target[0], target[1], target[2]);
        return object;
      }),
    [],
  );

  const rimTarget = useMemo(() => {
    const object = new Object3D();
    object.position.set(WINDOW_RIM_TARGET[0], WINDOW_RIM_TARGET[1], WINDOW_RIM_TARGET[2]);
    return object;
  }, []);

  return (
    <>
      {/* AMBIENT — barely there. Keeps the darkest surfaces off pure black
          (criterion 5) and, being tinted with the background rather than white,
          keeps the shadows navy rather than grey. */}
      <ambientLight color={BG_NIGHT} intensity={AMBIENT_INTENSITY} />

      {/* KEY — the desk lamp. The sole shadow-caster in the scene. */}
      <pointLight
        position={LAMP_POSITION}
        color={LAMP_WARM}
        intensity={LAMP_INTENSITY}
        distance={LAMP_DISTANCE}
        decay={LAMP_DECAY}
        castShadow
        shadow-mapSize-width={LAMP_SHADOW_MAP}
        shadow-mapSize-height={LAMP_SHADOW_MAP}
        shadow-bias={LAMP_SHADOW_BIAS}
      />

      {/* FILL x2 — monitor glow, aimed at the keyboard zone rather than
          radiating from the screens. Screen glow is directional, not radial. */}
      {MONITOR_FILL_POSITIONS.map((position, i) => (
        <group key={`fill-${i}`}>
          <primitive object={fillTargets[i] as Object3D} />
          <spotLight
            position={position}
            target={fillTargets[i]}
            color={GLOW_COOL}
            intensity={MONITOR_FILL_INTENSITY}
            distance={MONITOR_FILL_DISTANCE}
            decay={MONITOR_FILL_DECAY}
            angle={MONITOR_FILL_ANGLE}
            penumbra={MONITOR_FILL_PENUMBRA}
          />
        </group>
      ))}

      {/* RIM — the window. Cool separation edge on right-hand faces. */}
      <primitive object={rimTarget} />
      <directionalLight
        position={WINDOW_RIM_POSITION}
        target={rimTarget}
        color={GLOW_COOL_SOFT}
        intensity={WINDOW_RIM_INTENSITY}
      />

      {/* DOOR SPILL — off-frame warm. There is no door geometry: this light IS
          the doorway. A light source off-frame implies a space off-frame. */}
      <pointLight
        position={DOOR_SPILL_POSITION}
        color={LAMP_WARM}
        intensity={DOOR_SPILL_INTENSITY}
        distance={DOOR_SPILL_DISTANCE}
        decay={DOOR_SPILL_DECAY}
      />

      <RoomShell />
      <AndoWallDetails />
      <DeskSurface />
      {/* The bulb mesh has to sit exactly where the point light is, so both
          read LAMP_POSITION. The base sits on the desk top, y = 0. */}
      <Lamp
        position={[LAMP_POSITION[0], 0, LAMP_POSITION[2]]}
        bulbPosition={[LAMP_POSITION[0], LAMP_POSITION[1], LAMP_POSITION[2]]}
      />
      {/* x and z track MONITOR_FILL_POSITIONS so the cool fill appears to come
          off the screens. y puts the stand feet on the desk. */}
      {/* Every panel-opening object carries the same wrapper. The headphones
          are a TOGGLE, not a panel (08-interaction-grammar.md §4), and the
          focus mode they toggle does not exist yet, so they stay unwrapped
          rather than getting a wrapper that leads nowhere. */}
      <InteractiveObject
        id="monitor1"
        label="daily challenge"
        labelPosition={[MONITOR_FILL_POSITIONS[0][0], 0.64, MONITOR_FILL_POSITIONS[0][2]]}
        onActivate={() => focusObject('monitor1', 'challenge')}
      >
        <Monitor
          position={[MONITOR_FILL_POSITIONS[0][0], 0, MONITOR_FILL_POSITIONS[0][2]]}
          variant="primary"
          hoverId="monitor1"
        />
      </InteractiveObject>
      <InteractiveObject
        id="monitor2"
        label="goals"
        labelPosition={[MONITOR_FILL_POSITIONS[1][0], 0.64, MONITOR_FILL_POSITIONS[1][2]]}
        onActivate={() => focusObject('monitor2', 'goals')}
      >
        <Monitor
          position={[MONITOR_FILL_POSITIONS[1][0], 0, MONITOR_FILL_POSITIONS[1][2]]}
          variant="terminal"
          hoverId="monitor2"
        />
      </InteractiveObject>
      {/* The keyboard is what the monitor fill lights aim at, so it sits
          between them and forward of the screens. */}
      <Keyboard position={[0.1, KEYBOARD_DROP, 0.1]} />
      <Mug position={[-0.62, 0, 0.06]} />
      <InteractiveObject
        id="notebook"
        label="journal"
        labelPosition={[0.66, 0.18, 0.15]}
        onActivate={() => focusObject('notebook', 'journal')}
      >
        <Notebook position={[0.66, 0, 0.15]} />
      </InteractiveObject>
      <InteractiveObject
        id="phone"
        label="article import"
        labelPosition={[0.45, 0.18, 0.2]}
        onActivate={() => focusObject('phone', 'import')}
      >
        <Phone position={[0.45, 0, 0.2]} />
      </InteractiveObject>
      <Headphones position={[-0.42, 0, 0.14]} />
      {/* Right wall, in the opening RoomShell is built around (04-room-spec §6). */}
      <Window position={[1.98, 1.0, -0.3]} rotation={[0, -Math.PI / 2, 0]} />
      <DustMotes />

      <CameraRig />
      <Effects />
    </>
  );
}
