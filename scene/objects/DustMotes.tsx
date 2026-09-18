// A1.12 — dust motes. design-system/04-room-spec.md §5, "ambient population".
//
// 25 points drifting up through the lamp's cone. They are the cheapest thing
// in the room and they do more than anything else to stop it reading as empty
// geometry — but only because they are nearly invisible: size 0.005, opacity
// 0.08. Motes you can actually see read as snow.
//
// Confined to the lamp cone. Outside it there is nothing to catch them, so
// they would be invisible anyway and would only cost draw time.
//
// FROZEN under prefers-reduced-motion — the points stay mounted at their last
// positions rather than unmounting, because a lamp cone with nothing in it
// looks like a bug, whereas still dust looks like still air.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Points as ThreePoints } from 'three';

import { LAMP_WARM } from '../../lib/style/colors';
import { useSceneStore } from '../../lib/stores/scene';
import { LAMP_POSITION } from '../lighting';

const MOTE_COUNT = 25;

const X_MIN = -1.1;
const X_MAX = -0.3;
const Y_MIN = -0.7;
const Y_MAX = 0.35;
const Z_MIN = -0.5;
const Z_MAX = 0.2;

/** Beyond this distance from the lamp a mote is drawn gently back in. */
const CONE_RADIUS = 1.0;

interface Mote {
  speedY: number;
  speedX: number;
  speedZ: number;
  phaseX: number;
  phaseZ: number;
}

export function DustMotes() {
  const pointsRef = useRef<ThreePoints>(null);

  const [positions, motes] = useMemo(() => {
    const pos = new Float32Array(MOTE_COUNT * 3);
    const meta: Mote[] = [];
    for (let i = 0; i < MOTE_COUNT; i++) {
      pos[i * 3 + 0] = MathUtils.randFloat(X_MIN, X_MAX);
      pos[i * 3 + 1] = MathUtils.randFloat(Y_MIN, Y_MAX);
      pos[i * 3 + 2] = MathUtils.randFloat(Z_MIN, Z_MAX);
      meta.push({
        speedY: MathUtils.randFloat(0.01, 0.02),
        speedX: MathUtils.randFloat(0.005, 0.01),
        speedZ: MathUtils.randFloat(0.005, 0.01),
        phaseX: Math.random() * Math.PI * 2,
        phaseZ: Math.random() * Math.PI * 2,
      });
    }
    return [pos, meta] as const;
  }, []);

  useFrame((state, dt) => {
    const points = pointsRef.current;
    if (!points) return;
    // getState, not a subscription: this runs every frame (spec/05 §3).
    if (useSceneStore.getState().prefersReducedMotion) return;

    const attr = points.geometry.attributes.position;
    if (!attr) return;
    const pos = attr.array as Float32Array;
    const time = state.clock.getElapsedTime();

    for (let i = 0; i < MOTE_COUNT; i++) {
      const idx = i * 3;
      const m = motes[i]!;

      pos[idx + 1]! += m.speedY * dt * 1.5;

      // Wrap at the top of the cone, respawning somewhere new at the bottom.
      if (pos[idx + 1]! > Y_MAX) {
        pos[idx + 1] = Y_MIN;
        pos[idx + 0] = MathUtils.randFloat(X_MIN, X_MAX);
        pos[idx + 2] = MathUtils.randFloat(Z_MIN, Z_MAX);
      }

      pos[idx + 0]! += Math.sin(time * 0.6 + m.phaseX) * m.speedX * dt;
      pos[idx + 2]! += Math.cos(time * 0.4 + m.phaseZ) * m.speedZ * dt;

      // The sway has no restoring force of its own, so motes would wander out
      // of the cone over minutes. Pull them back rather than clamping, which
      // would pile them on an invisible wall.
      const dx = pos[idx + 0]! - LAMP_POSITION[0];
      const dz = pos[idx + 2]! - LAMP_POSITION[2];
      const dist = Math.hypot(dx, dz);
      if (dist > CONE_RADIUS) {
        pos[idx + 0]! -= (dx / dist) * 0.02 * dt;
        pos[idx + 2]! -= (dz / dist) * 0.02 * dt;
      }
    }

    attr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={LAMP_WARM}
        size={0.005}
        sizeAttenuation
        transparent
        opacity={0.08}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}
