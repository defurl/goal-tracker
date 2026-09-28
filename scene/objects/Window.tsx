// A1.11 — the window. design-system/04-room-spec.md §6.
//
// Four frame boxes and a mullion around transmissive glass, with two emissive
// planes behind it: sky above, city below. It is the room's one live surface —
// the planes' colour is meant to be driven by application state and lerped
// every frame, never snapped.
//
// The SKY follows the time of day (build plan 3.7): `localHour` picks a band
// from spec/05 §5's table (lib/sky.ts) and the plane lerps its emissive colour
// and intensity toward it at k = 0.05, snapping under reduced motion. The
// room stays nocturnal at every hour — the plane is emissive only and lights
// nothing, so the window brightens and the room does not.
//
// The CITY keeps its portfolio behaviour and is not driven by app state
// (spec/05 §5): GLOW_COOL_SOFT x 0.55 -> L 0.072, under the 0.1 bloom
// threshold. A second signal there would compete with the sky.
//
// The glass tint is INK_MUTED, not the BG_NIGHT that 04-room-spec.md §6 lists.
// MeshPhysicalMaterial multiplies transmitted light by `color`, and BG_NIGHT is
// about 4% brightness, so a BG_NIGHT pane extinguishes the planes behind it and
// the opening renders black — measured on both an Intel GPU and SwiftShader, so
// it is not a capture artefact. The glass is meant to be clear; the window's
// darkness comes from the dim planes behind it, not from tinting the pane.
// INK_MUTED rather than a near-white: at INK_PAPER the pane's grazing-angle
// Fresnel highlight reads as hard white bars across the top and bottom of the
// opening. Measured, INK_MUTED transmits the planes with no pixel above a
// 600/765 channel sum; INK_PAPER glares and INK_FAINT goes too dark to read.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type Group, type MeshStandardMaterial } from 'three';

import { lerpTo } from '../../lib/motion/lerp';
import { SKY_STATES, skyBand, type SkyBand } from '../../lib/sky';
import { useAppStore } from '../../lib/stores/app';
import { BG_PANEL, BG_VOID, GLOW_COOL_SOFT, INK_MUTED, RAIN_STREAK } from '../../lib/style/colors';
import { useSceneStore } from '../../lib/stores/scene';

interface WindowProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

const W = 0.7;
const H = 1.0;
const FRAME_T = 0.04;
const FRAME_DEPTH = 0.06;

const CITY_INTENSITY = 0.55;
const SKY_LERP = 0.05; // spec/05 §3

const DROP_COUNT = 18;
const DROP_Z = 0.012;

/**
 * Rain on the glass. 18 streaks falling 0.25-0.7 m/s and resetting at the
 * bottom frame (04-room-spec.md §5).
 *
 * Under prefers-reduced-motion it is REMOVED, not slowed — ambient motion is
 * not allowed to persist in a stilled form (03-motion.md principle 5). The
 * component returns null, so there is nothing left to animate.
 *
 * Every per-drop random lives in the memo. Rolling opacity during render would
 * reseed all 18 drops on any re-render, which flickers the whole sheet.
 */
function WindowRain() {
  const reduced = useSceneStore((s) => s.prefersReducedMotion);
  const groupRef = useRef<Group>(null);

  const drops = useMemo(
    () =>
      Array.from({ length: DROP_COUNT }, () => ({
        x: (Math.random() - 0.5) * (W - FRAME_T * 2.2),
        y: (Math.random() - 0.5) * (H - FRAME_T * 2.2),
        speed: 0.25 + Math.random() * 0.45,
        length: 0.015 + Math.random() * 0.025,
        opacity: 0.3 + Math.random() * 0.3,
      })),
    [],
  );

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;
    // Read the live value: the media query can flip mid-session.
    if (useSceneStore.getState().prefersReducedMotion) return;

    const bottom = -H / 2 + FRAME_T;
    const top = H / 2 - FRAME_T;
    group.children.forEach((child, i) => {
      const drop = drops[i];
      if (!drop) return;
      child.position.y -= drop.speed * dt;
      if (child.position.y < bottom) {
        child.position.y = top;
        child.position.x = (Math.random() - 0.5) * (W - FRAME_T * 2.2);
        drop.speed = 0.25 + Math.random() * 0.45;
      }
    });
  });

  if (reduced) return null;

  return (
    <group ref={groupRef}>
      {drops.map((drop, i) => (
        <mesh key={i} position={[drop.x, drop.y, DROP_Z]}>
          <planeGeometry args={[0.0018, drop.length]} />
          <meshBasicMaterial color={RAIN_STREAK} transparent opacity={drop.opacity} />
        </mesh>
      ))}
    </group>
  );
}

export function Window({ position, rotation = [0, 0, 0] }: WindowProps) {
  const skyRef = useRef<MeshStandardMaterial>(null);
  const cityRef = useRef<MeshStandardMaterial>(null);

  const bandColours = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(SKY_STATES) as SkyBand[]).map((band) => [band, new Color(SKY_STATES[band].color)]),
      ) as Record<SkyBand, Color>,
    [],
  );
  const settled = useRef(false);

  // Imperative reads only (spec/05 §1). The first hydrated frame snaps to the
  // current band, so loading the page does not fade in from night.
  useFrame(() => {
    const sky = skyRef.current;
    if (!sky) return;
    const { hydrated, localHour } = useAppStore.getState();
    if (!hydrated) return;
    const band = skyBand(localHour);
    const reduced = useSceneStore.getState().prefersReducedMotion;
    const k = !settled.current || reduced ? 1 : SKY_LERP;
    settled.current = true;
    sky.emissive.lerp(bandColours[band], k);
    sky.emissiveIntensity = lerpTo(sky.emissiveIntensity, SKY_STATES[band].intensity, k);
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Frame */}
      <mesh castShadow position={[0, H / 2 - FRAME_T / 2, 0]}>
        <boxGeometry args={[W, FRAME_T, FRAME_DEPTH]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.7} metalness={0.15} />
      </mesh>
      <mesh castShadow position={[0, -H / 2 + FRAME_T / 2, 0]}>
        <boxGeometry args={[W, FRAME_T, FRAME_DEPTH]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.7} metalness={0.15} />
      </mesh>
      <mesh castShadow position={[-W / 2 + FRAME_T / 2, 0, 0]}>
        <boxGeometry args={[FRAME_T, H - FRAME_T * 2, FRAME_DEPTH]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.7} metalness={0.15} />
      </mesh>
      <mesh castShadow position={[W / 2 - FRAME_T / 2, 0, 0]}>
        <boxGeometry args={[FRAME_T, H - FRAME_T * 2, FRAME_DEPTH]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.7} metalness={0.15} />
      </mesh>
      <mesh>
        <boxGeometry args={[W - FRAME_T * 2, FRAME_T * 0.4, FRAME_DEPTH * 0.6]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.7} metalness={0.15} />
      </mesh>

      {/* Glass. A plane, not a box: a box's edge faces catch the rim light and
          read as bright white strips across the top and bottom of the opening.
          `thickness` is a material parameter, so the pane loses nothing. */}
      <mesh>
        <planeGeometry args={[W - FRAME_T * 2, H - FRAME_T * 2]} />
        <meshPhysicalMaterial
          color={INK_MUTED}
          transmission={0.55}
          roughness={0.12}
          metalness={0.05}
          ior={1.45}
          thickness={0.05}
        />
      </mesh>

      <WindowRain />

      {/* Sky beyond */}
      <mesh position={[0, 0.25, -0.3]}>
        <planeGeometry args={[W * 0.92, H * 0.55]} />
        <meshStandardMaterial
          ref={skyRef}
          color={BG_VOID}
          emissive={SKY_STATES.night.color}
          emissiveIntensity={SKY_STATES.night.intensity}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* City beyond */}
      <mesh position={[0, -0.25, -0.3]}>
        <planeGeometry args={[W * 0.92, H * 0.55]} />
        <meshStandardMaterial
          ref={cityRef}
          color={BG_VOID}
          emissive={GLOW_COOL_SOFT}
          emissiveIntensity={CITY_INTENSITY}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
