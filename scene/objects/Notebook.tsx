// A1.8 — the notebook. design-system/04-room-spec.md §5.
//
// Closed, lying flat, spine on the long edge. The page block shows only on the
// edge opposite the spine, and a thin bookmark strip says "in use" without
// needing the book open.
//
// The bookmark is SIGNAL_DIM, lit by the lamp like everything else on the
// desk. It is also the notebook's one state-driven surface (spec/05 §3): on a
// day with a journal entry it takes on a faint SIGNAL glow, lerping 0 -> 0.15.
// SIGNAL L 0.474 x 0.15 = 0.071, under the 0.1 bloom threshold — "barely lit",
// noticed after twenty minutes rather than at a glance. Which surface carries
// the glow, and its colour, are PROPOSED; the spec gives only the intensity.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { MeshStandardMaterial } from 'three';

import { lerpTo } from '../../lib/motion/lerp';
import { useAppStore } from '../../lib/stores/app';
import { useSceneStore } from '../../lib/stores/scene';
import { BG_PANEL, INK_PAPER, SIGNAL, SIGNAL_DIM } from '../../lib/style/colors';

interface NotebookProps {
  /** Group origin sits at the desk surface, so y = 0. */
  position: [number, number, number];
}

const W = 0.18;
const D = 0.245;
const H = 0.014;

const LOGGED_INTENSITY = 0.15;
const LERP = 0.05; // spec/05 §3

export function Notebook({ position }: NotebookProps) {
  const bookmarkRef = useRef<MeshStandardMaterial>(null);

  // Imperative reads only (spec/05 §1).
  useFrame(() => {
    const material = bookmarkRef.current;
    if (!material) return;
    const target = useAppStore.getState().journal.todayLogged ? LOGGED_INTENSITY : 0;
    const reduced = useSceneStore.getState().prefersReducedMotion;
    material.emissiveIntensity = lerpTo(material.emissiveIntensity, target, reduced ? 1 : LERP);
  });

  return (
    <group position={position} rotation={[0, 0.18, 0]}>
      {/* Cover */}
      <mesh castShadow position={[0, H / 2, 0]}>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.88} metalness={0.02} />
      </mesh>

      {/* Page block, inset so it only reads from the open edge */}
      <mesh position={[0.001, H / 2, D / 2 - 0.002]}>
        <boxGeometry args={[W - 0.012, H - 0.003, 0.004]} />
        <meshStandardMaterial color={INK_PAPER} roughness={0.95} metalness={0} />
      </mesh>

      {/* Bookmark */}
      <mesh position={[W / 4, H + 0.0005, D / 4]}>
        <boxGeometry args={[0.006, 0.0008, 0.07]} />
        <meshStandardMaterial
          ref={bookmarkRef}
          color={SIGNAL_DIM}
          emissive={SIGNAL}
          emissiveIntensity={0}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}
