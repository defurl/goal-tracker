import { useMemo } from 'react';
import { Object3D } from 'three';
import { BG_NIGHT, BG_PANEL, LAMP_WARM, VOXEL_GLOW, VOXEL_GLOW_SOFT } from '../../lib/style/colors';
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
import { DeskSurface } from './objects/DeskSurface';
import { Lamp } from './objects/Lamp';
import { Monitor } from './objects/Monitor';
import { Window } from './objects/Window';
import { Keyboard } from './objects/Keyboard';
import { Mug } from './objects/Mug';
import { Plant } from './objects/Plant';
import { Headphones } from './objects/Headphones';
import { Notebook } from './objects/Notebook';
import { Phone } from './objects/Phone';
import { AndoWallDetails } from './objects/AndoWallDetails';
import { DustMotes } from './objects/DustMotes';
import { BloomLayer } from './postfx/BloomLayer';
import { InteractiveObject } from './InteractiveObject';
import { CameraRig } from './CameraRig';
import { useInteractionStore } from '../../lib/stores/interactionStore';
import { useDeskToCity } from './useDeskToCity';
import { useDeskToNn } from './useDeskToNn';
import { useAudioStore } from '../../lib/stores/audioStore';


// The Night Desk scene. All eleven objects (10 visible + door-spill light)
// per the revision prompt order-of-operations §3–§7.
//
// Lighting per `lighting-plan.svg` with revision-tuned values noted in
// `lighting.ts`: KEY at intensity 8, distance 2.8 (was 2.0 — extends pool
// to keyboard zone); FILL ×2 as SpotLights aimed at the keyboard (was
// PointLights, which puddled on the desk); RIM directional; DOOR SPILL
// pulled in to z=+0.5 with intensity 3.5 so it reads as a distinct source
// separated from the lamp's own floor pool.
export function DeskScene() {
  const focusObject = useInteractionStore(s => s.focusObject);
  const enterCity = useDeskToCity();
  const enterNn = useDeskToNn();

  // Directional rim light needs a Three.js Object3D as its `.target`.
  const rimTarget = useMemo(() => {
    const o = new Object3D();
    o.position.set(...(WINDOW_RIM_TARGET as unknown as [number, number, number]));
    return o;
  }, []);

  // SpotLight targets for monitor fills — one per fill, persistent.
  const monitorFillTargets = useMemo(
    () =>
      MONITOR_FILL_TARGETS.map(t => {
        const o = new Object3D();
        o.position.set(...(t as unknown as [number, number, number]));
        return o;
      }),
    [],
  );

  return (
    <>
      {/* Ambient — barely there. BG_NIGHT carries the dark-room base tone. */}
      <ambientLight intensity={AMBIENT_INTENSITY} color={BG_NIGHT} />

      {/* KEY — desk lamp. The brightest source and the only shadow-caster. */}
      <pointLight
        position={LAMP_POSITION as unknown as [number, number, number]}
        color={LAMP_WARM}
        intensity={LAMP_INTENSITY}
        distance={LAMP_DISTANCE}
        decay={LAMP_DECAY}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />

      {/* FILL — cool monitor glow as SpotLights aimed at the keyboard zone.
          The cone (~34°, soft penumbra) drops the cyan onto the front faces
          of objects rather than puddling on the desk surface behind them. */}
      {MONITOR_FILL_POSITIONS.map((pos, i) => (
        <group key={`monitor-fill-${i}`}>
          <primitive object={monitorFillTargets[i]} />
          <spotLight
            position={pos as unknown as [number, number, number]}
            target={monitorFillTargets[i]}
            color={VOXEL_GLOW}
            intensity={MONITOR_FILL_INTENSITY}
            distance={MONITOR_FILL_DISTANCE}
            decay={MONITOR_FILL_DECAY}
            angle={MONITOR_FILL_ANGLE}
            penumbra={MONITOR_FILL_PENUMBRA}
          />
        </group>
      ))}

      {/* RIM — cool window directional. */}
      <primitive object={rimTarget} />
      <directionalLight
        position={WINDOW_RIM_POSITION as unknown as [number, number, number]}
        color={VOXEL_GLOW_SOFT}
        intensity={WINDOW_RIM_INTENSITY}
        target={rimTarget}
      />

      {/* DOOR SPILL — off-frame warm. */}
      <pointLight
        position={DOOR_SPILL_POSITION as unknown as [number, number, number]}
        color={LAMP_WARM}
        intensity={DOOR_SPILL_INTENSITY}
        distance={DOOR_SPILL_DISTANCE}
        decay={DOOR_SPILL_DECAY}
      />

      {/* Floor — 10m × 10m, BG_PANEL, receiveShadow. 74cm below desk top. */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.74, 0]}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Back wall — single solid panel, 6m × 2.5m at z=-1.2, no cutout. */}
      <mesh receiveShadow position={[0, 0.51, -1.2]}>
        <planeGeometry args={[6, 2.5]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Right side wall — built as four segments around the window opening.
          Wall plane at x=+2.0 facing -X (normal toward camera at x=0). Y range
          mirrors back wall (-0.74..+1.76). Z range -1.2..+2.5 covers from the
          back-wall corner forward past the camera, so the right edge of the
          frame reads as a real room edge instead of empty void. Window opening:
          0.7m wide × 1m tall, centered at (2.0, 1.0, -0.3) — z=-0.3 places it
          roughly behind the monitors so it's visible past their right edge. */}
      {/* Behind window — from z=-1.2 to z=-0.65 (depth 0.55), full height */}
      <mesh receiveShadow position={[2.0, 0.51, -0.925]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.55, 2.5]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* In front of window — from z=+0.05 to z=+2.5 (depth 2.45), full height */}
      <mesh receiveShadow position={[2.0, 0.51, 1.275]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.45, 2.5]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Above window — z range matches opening (0.7m), y=1.5..1.76 (0.26m) */}
      <mesh receiveShadow position={[2.0, 1.63, -0.3]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.7, 0.26]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Below window — z range matches opening, y=-0.74..0.5 (1.24m) */}
      <mesh receiveShadow position={[2.0, -0.12, -0.3]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.7, 1.24]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.85} metalness={0.05} />
      </mesh>

      <DeskSurface />
      <Lamp
        position={[LAMP_POSITION[0], 0, LAMP_POSITION[2]]}
        bulbPosition={LAMP_POSITION as unknown as [number, number, number]}
      />

      {/* Object Y positions are all foot-on-desk — i.e., position.y equals
          the offset from the group origin down to the object's lowest point
          so each base lands on the desk top (y=0). Monitor stand foot sits
          0.306m below its group origin for a 0.36m-tall bezel (foot offset
          = height/2 + 0.12), so Monitor 1 sits at y=0.306; Monitor 2 with
          a 0.3m bezel sits at y=0.27. Keyboard's lower body extends 0.011m
          below the plate's group origin, so y=0.011 puts the keyboard's
          lowest face on the desk. All others (Mug/Phone/Plant/Notebook)
          have group origin = base, so y=0. */}
      {/* ── Interactive nav objects (Checkpoint B) ────────────────────────
          Monitor 1/2 + Notebook open side panels; Phone flips for contact;
          Headphones toggle audio (no camera glide); Window glides the camera
          toward it (the /city scene transition lands with Layer 2). */}
      <InteractiveObject
        id="monitor1"
        label="projects"
        labelPosition={[-0.3, 0.64, -0.4]}
        onActivate={() => focusObject('monitor1', 'projects')}
      >
        <Monitor variant="primary" position={[-0.3, 0.306, -0.4]} hoverId="monitor1" />
      </InteractiveObject>

      <InteractiveObject
        id="monitor2"
        label="terminal"
        labelPosition={[0.5, 0.56, -0.4]}
        onActivate={() => focusObject('monitor2', 'terminal')}
      >
        <Monitor variant="terminal" position={[0.5, 0.27, -0.4]} width={0.5} height={0.3} hoverId="monitor2" />
      </InteractiveObject>

      {/* Window mounted on the RIGHT side wall — wall plane at x=2.0, frame
          2cm inside. Rotated -π/2 around Y so the frame faces -X. Click
          glides the camera to it; no panel (the /city transition is Layer 2). */}
      <InteractiveObject
        id="window"
        label="city"
        labelPosition={[1.7, 1.6, -0.3]}
        onActivate={enterCity}
      >
        <Window position={[1.98, 1.0, -0.3]} rotation={[0, -Math.PI / 2, 0]} />
      </InteractiveObject>

      {/* Non-nav objects — not wrapped (no hover affordance this round).
          Subtle hover feedback for lamp/mug/plant/keyboard is deferred. */}
      <Keyboard position={[0, 0.011, 0.2]} />
      <Mug position={[-0.55, 0, 0.15]} />
      <Plant position={[-0.8, 0, 0.1]} />

      <InteractiveObject
        id="notebook"
        label="notebook"
        labelPosition={[-0.4, 0.2, 0.05]}
        onActivate={() => focusObject('notebook', 'notebook')}
      >
        <Notebook position={[-0.4, 0, 0.05]} />
      </InteractiveObject>

      {/* Headphones toggle the desk audio — no camera glide, no panel. */}
      <InteractiveObject
        id="headphones"
        label="sound"
        labelPosition={[0.85, 0.26, 0.15]}
        onActivate={() => useAudioStore.getState().toggle()}
      >
        <Headphones position={[0.85, 0.045, 0.15]} />
      </InteractiveObject>

      <InteractiveObject
        id="phone"
        label="contact"
        labelPosition={[0.7, 0.18, -0.1]}
        onActivate={() => focusObject('phone', 'contact')}
      >
        <Phone position={[0.7, 0, -0.1]} />
      </InteractiveObject>

      {/* Door spill hit area — the warm light patch on the floor camera-left
          is the "doorway" into Layer 3. Wrap a transparent floor disc in an
          InteractiveObject so the existing hover/label/click grammar
          applies and the camera glides to the door focus pose. */}
      <InteractiveObject
        id="door"
        label="step through"
        labelPosition={[-1.0, 0.05, 0.3]}
        onActivate={enterNn}
      >
        <mesh position={[-1.0, -0.73, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.45, 24]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </InteractiveObject>

      <AndoWallDetails />
      <DustMotes />
      <BloomLayer />
      <CameraRig />
    </>

  );
}
