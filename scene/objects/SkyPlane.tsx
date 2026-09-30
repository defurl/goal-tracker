// A sky seen through an opening: an emissive plane that follows the time of day
// (build plan 3.7, spec/05 §5). The room's window has one; the hall's
// clerestory has another (design-system/13 §2), so they always agree.
//
// `localHour` picks a band from lib/sky.ts and the plane lerps its emissive
// colour and intensity toward it at k = 0.05, snapping under reduced motion.
// The first hydrated frame snaps, so loading a page does not fade in from
// night. The plane is emissive only and lights nothing: the window brightens,
// the room does not.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type MeshStandardMaterial } from 'three';

import { lerpTo } from '../../lib/motion/lerp';
import { SKY_STATES, skyBand, type SkyBand } from '../../lib/sky';
import { useAppStore } from '../../lib/stores/app';
import { useSceneStore } from '../../lib/stores/scene';
import { BG_VOID } from '../../lib/style/colors';

const SKY_LERP = 0.05; // spec/05 §3

interface SkyPlaneProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number];
  /**
   * Multiplies every band's intensity. 1 for the room's window, which sits out
   * of the rest frame behind glass; the hall's clerestory is in frame, bare,
   * and at the room's day value it outshone the tree's pool (13 §5).
   */
  scale?: number;
}

export function SkyPlane({ position, rotation = [0, 0, 0], size, scale = 1 }: SkyPlaneProps) {
  const skyRef = useRef<MeshStandardMaterial>(null);
  const bandColours = useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(SKY_STATES) as SkyBand[]).map((band) => [band, new Color(SKY_STATES[band].color)]),
      ) as Record<SkyBand, Color>,
    [],
  );
  const settled = useRef(false);

  // Imperative reads only (spec/05 §1).
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
    sky.emissiveIntensity = lerpTo(sky.emissiveIntensity, SKY_STATES[band].intensity * scale, k);
  });

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshStandardMaterial
        ref={skyRef}
        color={BG_VOID}
        emissive={SKY_STATES.night.color}
        emissiveIntensity={SKY_STATES.night.intensity * scale}
        roughness={1}
        metalness={0}
        toneMapped={false}
      />
    </mesh>
  );
}
