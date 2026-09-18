import type { ObjectId } from '../../lib/stores/interactionStore';

// Camera poses for the desk scene. REST is the Checkpoint-A framing; each
// focusable object has a pose the camera glides to on click. A pose is a
// position + a lookAt target. Tuned by eye against the rendered scene —
// expect the owner to nudge these after the first screenshot review.

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

export const REST_POSE: CameraPose = {
  position: [0, 1.15, 2.2],
  target: [0, 0.4, 0],
};

/** Mobile rest pose (1.21) — raised, tilted further down, FOV-tightened by
 *  DeskRoute. Frames more of the desk for the orthographic-ish overview. */
export const REST_POSE_MOBILE: CameraPose = {
  position: [0, 1.6, 2.4],
  target: [0, -0.05, -0.1],
};

// Focus poses. The monitor screen sits left-of-centre in each so the 480px
// panel sliding in from the right doesn't occlude it.
export const FOCUS_POSES: Record<ObjectId, CameraPose> = {
  // Monitor 1 (primary, projects) — group at [-0.3, 0.306, -0.4], screen
  // front face ~z=-0.388. Camera ~0.5m in front, biased left.
  monitor1: { position: [-0.5, 0.42, 0.25], target: [-0.32, 0.34, -0.4] },
  // Monitor 2 (terminal) — group at [0.5, 0.27, -0.4].
  monitor2: { position: [0.28, 0.4, 0.25], target: [0.5, 0.32, -0.4] },
  // Notebook on the desk camera-left.
  notebook: { position: [-0.55, 0.5, 0.45], target: [-0.4, 0.0, 0.05] },
  // Headphones, right of the keyboard.
  headphones: { position: [0.6, 0.42, 0.6], target: [0.85, 0.04, 0.15] },
  // Phone, sits clearly on the desk between keyboard and headphones.
  phone: { position: [0.5, 0.42, 0.45], target: [0.7, 0.05, -0.1] },
  // Window on the right wall — camera turns toward it.
  window: { position: [0.4, 0.9, 0.9], target: [1.98, 1.0, -0.3] },
  // Door spill on the floor camera-left (no geometry — frame the warm patch).
  door: { position: [-0.4, 0.7, 1.2], target: [-1.4, -0.74, 0.3] },
};
