import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useInteractionStore } from '../../lib/stores/interactionStore';
import { useSceneStore } from '../../lib/stores/sceneStore';
import { REST_POSE, REST_POSE_MOBILE, FOCUS_POSES, type CameraPose } from './cameraPoses';

// Hand-rolled cinematic camera glide (Checkpoint B 1.12). On `focus` change
// the camera lerps position + lookAt from its current pose to the target
// pose over GLIDE_MS, eased. Under prefers-reduced-motion the glide is
// instant (the panel still crossfades in via CSS).
//
// We track the lookAt point ourselves (Three.js cameras don't store one) and
// call camera.lookAt every frame.

const GLIDE_MS = 2200; // matches --dur-camera

// easeInOutCubic — a close, solver-free stand-in for the design-spec's
// camera-glide cubic-bezier(0.65, 0, 0.35, 1).
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function CameraRig() {
  const camera = useThree(s => s.camera);
  const focus = useInteractionStore(s => s.focus);

  // Glide bookkeeping.
  const fromPos = useRef(new Vector3(...REST_POSE.position));
  const fromTarget = useRef(new Vector3(...REST_POSE.target));
  const toPos = useRef(new Vector3(...REST_POSE.position));
  const toTarget = useRef(new Vector3(...REST_POSE.target));
  const lookAt = useRef(new Vector3(...REST_POSE.target));
  const elapsed = useRef(GLIDE_MS); // start "settled" at rest
  const lastFocus = useRef<typeof focus>(null);

  useFrame((_, dt) => {
    // Detect a focus change → start a new glide.
    if (focus !== lastFocus.current) {
      lastFocus.current = focus;
      const restPose: CameraPose = useSceneStore.getState().isMobile ? REST_POSE_MOBILE : REST_POSE;
      const dest: CameraPose = focus ? FOCUS_POSES[focus] : restPose;
      fromPos.current.copy(camera.position);
      fromTarget.current.copy(lookAt.current);
      toPos.current.set(...dest.position);
      toTarget.current.set(...dest.target);
      elapsed.current = useSceneStore.getState().prefersReducedMotion ? GLIDE_MS : 0;
    }

    if (elapsed.current < GLIDE_MS) {
      elapsed.current = Math.min(elapsed.current + dt * 1000, GLIDE_MS);
      const t = easeInOutCubic(elapsed.current / GLIDE_MS);
      camera.position.lerpVectors(fromPos.current, toPos.current, t);
      lookAt.current.lerpVectors(fromTarget.current, toTarget.current, t);
      camera.lookAt(lookAt.current);
    } else if (focus !== null || !camera.position.equals(toPos.current)) {
      // Settled — keep the camera pinned to the destination (covers the
      // reduced-motion instant case and any drift).
      camera.position.copy(toPos.current);
      lookAt.current.copy(toTarget.current);
      camera.lookAt(lookAt.current);
    }
  });

  return null;
}
