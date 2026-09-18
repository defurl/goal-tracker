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
 *
 * The poses ported from the portfolio did NOT satisfy that rule here — the
 * objects sit at different places on a wider desk, and monitor 1 filled the
 * frame centre with the panel over half of it. Each pose below is derived from
 * its object's actual position and then checked against a real open panel, at
 * 16:10. The camera looks to the RIGHT of its object, which is what puts the
 * object left of centre; targeting the object itself centres it.
 */
export const FOCUS_POSES: Record<ObjectId, CameraPose> = {
  monitor1: { position: [-0.65, 0.51, 0.75], target: [0.04, 0.31, -0.3] },
  monitor2: { position: [0.15, 0.51, 0.75], target: [0.84, 0.31, -0.3] },
  notebook: { position: [0.66, 0.43, 0.65], target: [0.89, 0.01, 0.15] },
  headphones: { position: [0.6, 0.42, 0.6], target: [0.85, 0.04, 0.15] },
  phone: { position: [0.45, 0.33, 0.58], target: [0.63, 0.0, 0.2] },
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
