// A1.9 — the phone. design-system/04-room-spec.md §5.
//
// In this product the phone is Article Import (lib/stores/interaction.ts), not
// the portfolio's contact card, so the flip-to-reveal-an-email behaviour it
// carried there is deliberately not ported.
//
// It lies FACE UP. The portfolio had it face down, but its one in-world signal
// is the screen warming while the import agent runs (spec/05 §3), and a screen
// against the desk cannot be seen. PROPOSED — raised with the owner.
//
// The screen at rest is a dim cool glow, below the 0.1 bloom threshold so it
// reads as a phone left on, not as a light: GLOW_COOL_SOFT L 0.130 x 0.35 =
// 0.046. While `importing` it lerps to SIGNAL_DIM at 1.1 — L 0.114 x 1.1 =
// 0.126, just over the threshold, the same level as monitor 1 on an ordinary
// day. Re-measure both before changing either (D-20, D-21).

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type MeshStandardMaterial } from 'three';

import { lerpTo } from '../../lib/motion/lerp';
import { useAppStore } from '../../lib/stores/app';
import { useSceneStore } from '../../lib/stores/scene';
import { BG_VOID, GLOW_COOL_SOFT, SIGNAL_DIM } from '../../lib/style/colors';

interface PhoneProps {
  /** Group origin sits at the desk surface, so y = 0. */
  position: [number, number, number];
}

const W = 0.075;
const D = 0.15;
const H = 0.008;

const REST_INTENSITY = 0.35;
const IMPORTING_INTENSITY = 1.1;
const LERP = 0.08; // spec/05 §3

export function Phone({ position }: PhoneProps) {
  const screenRef = useRef<MeshStandardMaterial>(null);
  // 0 at rest, 1 while importing; colour and intensity both follow it.
  const warmth = useRef<number | null>(null);
  const colours = useMemo(() => ({ rest: new Color(GLOW_COOL_SOFT), warm: new Color(SIGNAL_DIM) }), []);

  // Imperative reads only (spec/05 §1).
  useFrame(() => {
    const material = screenRef.current;
    if (!material) return;
    const target = useAppStore.getState().importing ? 1 : 0;
    const reduced = useSceneStore.getState().prefersReducedMotion;
    warmth.current = warmth.current === null ? target : lerpTo(warmth.current, target, reduced ? 1 : LERP);
    material.emissive.lerpColors(colours.rest, colours.warm, warmth.current);
    material.emissiveIntensity = lerpTo(REST_INTENSITY, IMPORTING_INTENSITY, warmth.current);
  });

  return (
    <group position={position} rotation={[0, -0.15, 0]}>
      <group position={[0, H / 2, 0]}>
        {/* Body */}
        <mesh castShadow>
          <boxGeometry args={[W, H, D]} />
          <meshStandardMaterial color={BG_VOID} roughness={0.25} metalness={0.5} />
        </mesh>

        {/* Screen, facing up, 0.5 mm proud of the body */}
        <mesh position={[0, H / 2 + 0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W - 0.006, D - 0.006]} />
          <meshStandardMaterial
            ref={screenRef}
            color={BG_VOID}
            emissive={GLOW_COOL_SOFT}
            roughness={0.6}
            metalness={0}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
