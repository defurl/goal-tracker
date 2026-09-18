import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { type Points as ThreePoints, MathUtils } from 'three';
import { LAMP_WARM } from '../../../lib/style/colors';
import { useSceneStore } from '../../../lib/stores/sceneStore';

// Cinematic Volumetric Dust Motes
// Renders 50 tiny glowing particles slowly drifting and swirling in the lamp's
// warm spotlight beam. Instantly elevates the room from empty geometry into a
// premium, photorealistic, lived-in scene.
//
// Confined to the lamp's warm light cone area: x: [-1.3 .. -0.1], y: [-0.7 .. 0.35], z: [-0.6 .. 0.3].

const MOTE_COUNT = 25;

export function DustMotes() {
  const pointsRef = useRef<ThreePoints>(null);

  // Initialize random starting positions and velocities
  const [positions, data] = useMemo(() => {
    const pos = new Float32Array(MOTE_COUNT * 3);
    const meta: Array<{
      speedY: number;
      speedX: number;
      speedZ: number;
      phaseX: number;
      phaseZ: number;
      scale: number;
    }> = [];

    for (let i = 0; i < MOTE_COUNT; i++) {
      // Spawn within the lamp light cone bounds
      pos[i * 3 + 0] = MathUtils.randFloat(-1.1, -0.3); // x
      pos[i * 3 + 1] = MathUtils.randFloat(-0.7, 0.35); // y
      pos[i * 3 + 2] = MathUtils.randFloat(-0.5, 0.2);  // z

      meta.push({
        speedY: MathUtils.randFloat(0.01, 0.02), // slow upward drift
        speedX: MathUtils.randFloat(0.005, 0.01),
        speedZ: MathUtils.randFloat(0.005, 0.01),
        phaseX: Math.random() * Math.PI * 2,
        phaseZ: Math.random() * Math.PI * 2,
        scale: MathUtils.randFloat(0.2, 0.8),
      });
    }

    return [pos, meta];
  }, []);

  // Update positions frame-by-frame
  useFrame((state, dt) => {
    const points = pointsRef.current;
    if (!points) return;

    const reduced = useSceneStore.getState().prefersReducedMotion;
    if (reduced) return; // freeze in place under prefers-reduced-motion

    const pos = points.geometry.attributes.position.array as Float32Array;
    const time = state.clock.getElapsedTime();

    for (let i = 0; i < MOTE_COUNT; i++) {
      const idx = i * 3;
      const m = data[i]!;

      // Drift upward
      pos[idx + 1] += m.speedY * dt * 1.5;

      // Wrap-around Y if they float past the lamp shade
      if (pos[idx + 1] > 0.35) {
        pos[idx + 1] = -0.7;
        pos[idx + 0] = MathUtils.randFloat(-1.1, -0.3);
        pos[idx + 2] = MathUtils.randFloat(-0.5, 0.2);
      }

      // Sine-wave horizontal drift (gentle sway)
      pos[idx + 0] += Math.sin(time * 0.6 + m.phaseX) * m.speedX * dt;
      pos[idx + 2] += Math.cos(time * 0.4 + m.phaseZ) * m.speedZ * dt;

      // Keep clamped to radius of lamp pool
      const dx = pos[idx + 0] - (-0.95);
      const dz = pos[idx + 2] - (-0.2);
      const dist = Math.hypot(dx, dz);
      if (dist > 1.0) {
        // Gently pull back toward lamp center
        pos[idx + 0] -= (dx / dist) * 0.02 * dt;
        pos[idx + 2] -= (dz / dist) * 0.02 * dt;
      }
    }

    points.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        color={LAMP_WARM}
        size={0.005} // extremely fine dust
        sizeAttenuation
        transparent
        opacity={0.08} // barely visible cinematic texture
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

