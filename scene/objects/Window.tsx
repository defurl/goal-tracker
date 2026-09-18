// A1.11 — the window. design-system/04-room-spec.md §6.
//
// Four frame boxes and a mullion around transmissive glass, with two emissive
// planes behind it: sky above, city below. It is the room's one live surface —
// the planes' colour is meant to be driven by application state and lerped
// every frame, never snapped.
//
// **The state source is not wired yet.** In the portfolio these tracked market
// session and index direction; here the window is time of day
// (12-habit-tracker-adaptation.md §2), which is a Phase 3 mechanic. The planes
// hold a fixed night tint until then, and the refs are kept so rewiring is a
// change of source rather than a rebuild.
//
// Both planes sit UNDER the 0.1 bloom threshold on purpose (D-20, D-21):
//   sky   GLOW_COOL_SOFT x 0.35 -> L 0.046
//   city  GLOW_COOL_SOFT x 0.55 -> L 0.072
// A night sky that blooms is a lit sky. The city is the brighter of the two
// because the light at night comes from below.
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

import { useRef } from 'react';
import { type MeshStandardMaterial } from 'three';

import { BG_PANEL, BG_VOID, GLOW_COOL_SOFT, INK_MUTED } from '../../lib/style/colors';

interface WindowProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

const W = 0.7;
const H = 1.0;
const FRAME_T = 0.04;
const FRAME_DEPTH = 0.06;

const SKY_INTENSITY = 0.35;
const CITY_INTENSITY = 0.55;

export function Window({ position, rotation = [0, 0, 0] }: WindowProps) {
  const skyRef = useRef<MeshStandardMaterial>(null);
  const cityRef = useRef<MeshStandardMaterial>(null);

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

      {/* Sky beyond */}
      <mesh position={[0, 0.25, -0.3]}>
        <planeGeometry args={[W * 0.92, H * 0.55]} />
        <meshStandardMaterial
          ref={skyRef}
          color={BG_VOID}
          emissive={GLOW_COOL_SOFT}
          emissiveIntensity={SKY_INTENSITY}
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
