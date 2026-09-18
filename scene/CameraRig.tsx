// Hand-rolled cinematic camera glide. No animation library: the frame loop owns
// animation in the 3D layer (D-05).
//
// Renders null. It reads `focus` from the interaction store as a normal
// subscription because focus changes on click, not per tick — the rule in
// spec/05-scene-state-contract.md §1 forbids subscribing to values that change
// EVERY FRAME, and everything read inside useFrame below uses getState().

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useInteractionStore } from '../lib/stores/interaction';
import { useSceneStore } from '../lib/stores/scene';
import { REST_POSE, REST_POSE_MOBILE, FOCUS_POSES, type CameraPose } from './cameraPoses';

/** Matches --dur-camera. Keep the two in sync by name if either changes. */
const GLIDE_MS = 2200;

/** A solver-free stand-in for the design system's cubic-bezier(0.65, 0, 0.35, 1). */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const focus = useInteractionStore((s) => s.focus);

  // Three.js cameras do not store a lookAt point, so the rig tracks it.
  const fromPosition = useRef(new Vector3(...REST_POSE.position));
  const fromTarget = useRef(new Vector3(...REST_POSE.target));
  const toPosition = useRef(new Vector3(...REST_POSE.position));
  const toTarget = useRef(new Vector3(...REST_POSE.target));
  const lookAt = useRef(new Vector3(...REST_POSE.target));
  const elapsed = useRef(GLIDE_MS); // start settled at rest
  const lastFocus = useRef<typeof focus>(null);

  useFrame((_, dt) => {
    if (focus !== lastFocus.current) {
      lastFocus.current = focus;
      const { isMobile, prefersReducedMotion } = useSceneStore.getState();
      const restPose: CameraPose = isMobile ? REST_POSE_MOBILE : REST_POSE;
      const destination: CameraPose = focus ? FOCUS_POSES[focus] : restPose;

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
