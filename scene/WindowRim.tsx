// The RIM role — the window's directional light (design-system/05-lighting-rig.md)
// — now following the time of day (A5.4, D-24 §9; 12 §6 option 2).
//
// Same light, same position, colour and target as before: the rig is still five
// roles and six instances. Only its intensity moves, from the rig's 1.2 after
// dark toward 2.5 by day (lib/sky.ts RIM_STATES), so the room stays nocturnal
// and the daylight arrives only as a stronger cool edge from the window side.
//
// Read imperatively each frame (spec/05 §1) and lerped at the sky's k = 0.05,
// so the rim and the sky change together. The first hydrated frame snaps, and
// reduced motion snaps, as the sky does.

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { DirectionalLight, Object3D } from 'three';

import { lerpTo } from '../lib/motion/lerp';
import { RIM_STATES, skyBand } from '../lib/sky';
import { useAppStore } from '../lib/stores/app';
import { useSceneStore } from '../lib/stores/scene';
import { GLOW_COOL_SOFT } from '../lib/style/colors';
import { WINDOW_RIM_INTENSITY, WINDOW_RIM_POSITION } from './lighting';

const RIM_LERP = 0.05; // spec/05 §3, as the sky

interface WindowRimProps {
  target: Object3D;
  /** Where the light comes from: the room's window by default; the hall's clerestory there. */
  position?: readonly [number, number, number];
  /**
   * Multiplies RIM_STATES, for a rig scaled to a bigger space at the room's
   * ratios (design-system/05: "keep these ratios"). 1 in the room.
   */
  scale?: number;
}

export function WindowRim({ target, position = WINDOW_RIM_POSITION, scale = 1 }: WindowRimProps) {
  const lightRef = useRef<DirectionalLight>(null);
  const settled = useRef(false);

  useFrame(() => {
    const light = lightRef.current;
    if (!light) return;
    const { hydrated, localHour } = useAppStore.getState();
    if (!hydrated) return;
    const reduced = useSceneStore.getState().prefersReducedMotion;
    const k = !settled.current || reduced ? 1 : RIM_LERP;
    settled.current = true;
    light.intensity = lerpTo(light.intensity, RIM_STATES[skyBand(localHour)] * scale, k);
  });

  return (
    <directionalLight
      ref={lightRef}
      position={position as [number, number, number]}
      target={target}
      color={GLOW_COOL_SOFT}
      intensity={WINDOW_RIM_INTENSITY * scale}
    />
  );
}
