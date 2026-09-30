// Hand-rolled cinematic camera glide. No animation library: the frame loop owns
// animation in the 3D layer (D-05).
//
// Renders null. It reads `focus` from the interaction store as a normal
// subscription because focus changes on click, not per tick — the rule in
// spec/05-scene-state-contract.md §1 forbids subscribing to values that change
// EVERY FRAME, and everything read inside useFrame below uses getState().

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type PerspectiveCamera } from 'three';
import { CAMERA_MS as GLIDE_MS } from '../lib/motion/durations';
import { useInteractionStore } from '../lib/stores/interaction';
import { useSceneStore } from '../lib/stores/scene';
import { FOCUS_POSES, isPortrait, portraitPose, type CameraPose } from './cameraPoses';

/** A solver-free stand-in for the design system's cubic-bezier(0.65, 0, 0.35, 1). */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface CameraRigProps {
  /** The scene's rest pose, and its variant for a phone. Each scene has its own. */
  rest: CameraPose;
  restMobile: CameraPose;
}

export function CameraRig({ rest, restMobile }: CameraRigProps) {
  const camera = useThree((s) => s.camera);
  const focus = useInteractionStore((s) => s.focus);

  // Three.js cameras do not store a lookAt point, so the rig tracks it.
  const fromPosition = useRef(new Vector3(...rest.position));
  const fromTarget = useRef(new Vector3(...rest.target));
  const toPosition = useRef(new Vector3(...rest.position));
  const toTarget = useRef(new Vector3(...rest.target));
  const lookAt = useRef(new Vector3(...rest.target));
  const elapsed = useRef(GLIDE_MS); // start settled at rest
  const lastFocus = useRef<typeof focus>(null);
  const lastPortrait = useRef<boolean | null>(null);

  useFrame(({ size }, dt) => {
    // A frame taller than wide gets the portrait focus poses (cameraPoses.ts):
    // the wide ones push the object off the left edge. Rotating a device while
    // an object is focused re-aims the camera for the new shape.
    const aspect = size.width / Math.max(size.height, 1);
    const portrait = isPortrait(aspect);
    const reshaped = focus !== null && lastPortrait.current !== null && portrait !== lastPortrait.current;
    lastPortrait.current = portrait;

    if (focus !== lastFocus.current || reshaped) {
      lastFocus.current = focus;
      const { isMobile, prefersReducedMotion } = useSceneStore.getState();
      const restPose: CameraPose = isMobile ? restMobile : rest;
      const fov = (camera as PerspectiveCamera).fov;
      const destination: CameraPose = focus
        ? portrait
          ? portraitPose(focus, aspect, fov)
          : FOCUS_POSES[focus]
        : restPose;

      fromPosition.current.copy(camera.position);
      fromTarget.current.copy(lookAt.current);
      toPosition.current.set(...destination.position);
      toTarget.current.set(...destination.target);

      // Reduced motion completes the glide on frame 1 — removed, not slowed.
      elapsed.current = prefersReducedMotion ? GLIDE_MS : 0;
    }

    if (elapsed.current < GLIDE_MS) {
      elapsed.current = Math.min(elapsed.current + dt * 1000, GLIDE_MS);
      const t = easeInOutCubic(elapsed.current / GLIDE_MS);
      camera.position.lerpVectors(fromPosition.current, toPosition.current, t);
      lookAt.current.lerpVectors(fromTarget.current, toTarget.current, t);
      camera.lookAt(lookAt.current);
    } else if (focus !== null || !camera.position.equals(toPosition.current)) {
      // Settled. Covers the reduced-motion instant case and any drift.
      camera.position.copy(toPosition.current);
      lookAt.current.copy(toTarget.current);
      camera.lookAt(lookAt.current);
    }
  });

  return null;
}
