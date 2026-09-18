import { useMemo } from 'react';
import { Color } from 'three';
import { BG_PANEL_2, DATA_GREEN, INK_GHOST } from '../../../lib/style/colors';

// Phase 1.6 — small desk plant. Cylindrical pot + 6 triangulated leaf planes
// radiating from the center with JITTERED rotation per instance (not radially
// symmetric — that's the plant-collision-adjacent fix in the revision spec).
//
// Leaf color: DATA_GREEN is the design-spec's bright signal-coded green;
// for a real-room houseplant we want a muted, low-key tone. We mix the
// token down at runtime (multiplyScalar 0.35) instead of introducing a
// new hex literal in this file. Keeps `lint:colors` happy and keeps
// colors.ts as the canonical palette source.

interface PlantProps {
  position: [number, number, number];
}

const POT_R_TOP = 0.045;
const POT_R_BOT = 0.038;
const POT_H = 0.07;
const LEAF_COUNT = 6;
const LEAF_LEN = 0.11;
const LEAF_WID = 0.045;

// Pseudo-random but deterministic — same arrangement every mount.
function jitter(seed: number, range: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 * range - range;
}

export function Plant({ position }: PlantProps) {
  const leafColor = useMemo(() => new Color(DATA_GREEN).multiplyScalar(0.35), []);

  const leaves: JSX.Element[] = [];
  for (let i = 0; i < LEAF_COUNT; i++) {
    const baseYaw = (i / LEAF_COUNT) * Math.PI * 2;
    const yaw = baseYaw + jitter(i * 1.7 + 0.3, 0.45);
    const pitch = -0.45 + jitter(i * 2.3 + 1.1, 0.35);
    const roll = jitter(i * 0.9 + 0.7, 0.4);
    const stemOffset = 0.014 + jitter(i * 3.1, 0.005);
    const yOffset = POT_H + LEAF_LEN * (0.32 + jitter(i * 1.3, 0.08));

    leaves.push(
      <mesh
        key={`leaf-${i}`}
        castShadow
        position={[Math.sin(yaw) * stemOffset, yOffset, Math.cos(yaw) * stemOffset]}
        rotation={[pitch, yaw, roll]}
      >
        <planeGeometry args={[LEAF_WID, LEAF_LEN]} />
        <meshStandardMaterial color={leafColor} roughness={0.9} metalness={0} side={2} />
      </mesh>,
    );
  }

  return (
    <group position={position}>
      <mesh castShadow position={[0, POT_H / 2, 0]}>
        <cylinderGeometry args={[POT_R_TOP, POT_R_BOT, POT_H, 24]} />
        <meshStandardMaterial color={BG_PANEL_2} roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh position={[0, POT_H - 0.002, 0]}>
        <cylinderGeometry args={[POT_R_TOP - 0.004, POT_R_TOP - 0.004, 0.004, 24]} />
        <meshStandardMaterial color={INK_GHOST} roughness={1} metalness={0} />
      </mesh>
      {leaves}
    </group>
  );
}
