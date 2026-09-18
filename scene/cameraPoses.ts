// Camera poses. The camera never free-orbits: it sits at one rest pose and
// glides to named framings (design-system/07-camera.md). That constraint is
// what lets every object be lit and composed for a known set of viewpoints.

import type { ObjectId } from '../lib/stores/interaction';

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

export const REST_POSE: CameraPose = {
  position: [0, 1.15, 2.2],
  target: [0, 0.4, 0],
};

/** Raised, tilted further down, FOV tightened by the canvas — a near-orthographic
 *  overview so the whole desk fits on a phone without scrolling. */
export const REST_POSE_MOBILE: CameraPose = {
  position: [0, 1.6, 2.4],
  target: [0, -0.05, -0.1],
};

/**
 * Focus poses. **Composition rule baked into every one: the focused object sits
 * LEFT of centre**, because the DOM detail panel slides in from the right at
 * ~480 px and would otherwise occlude it. If a panel ever comes from a different
 * edge, mirror the bias.
 */
export const FOCUS_POSES: Record<ObjectId, CameraPose> = {
  monitor1: { position: [-0.5, 0.42, 0.25], target: [-0.32, 0.34, -0.4] },
  monitor2: { position: [0.28, 0.4, 0.25], target: [0.5, 0.32, -0.4] },
  notebook: { position: [-0.55, 0.5, 0.45], target: [-0.4, 0.0, 0.05] },
  headphones: { position: [0.6, 0.42, 0.6], target: [0.85, 0.04, 0.15] },
  phone: { position: [0.5, 0.42, 0.45], target: [0.7, 0.05, -0.1] },
  window: { position: [0.4, 0.9, 0.9], target: [1.98, 1.0, -0.3] },
  door: { position: [-0.4, 0.7, 1.2], target: [-1.4, -0.74, 0.3] },

  // PROPOSED — the two BBE objects do not exist yet (Phase 3). These are
  // derived from their specified positions, not tuned against a render, and
  // must be re-framed once the geometry lands.
  //   bonsai   D-11: desk at [-0.8, 0, 0.1], capped at 0.35 m
  //   wallGrid back wall, the 365-day tracker
  bonsai: { position: [-0.95, 0.5, 0.75], target: [-0.8, 0.15, 0.1] },
  wallGrid: { position: [-0.2, 0.85, 0.9], target: [0, 0.75, -1.2] },
};
