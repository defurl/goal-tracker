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
 * The hall's arrival pose (design-system/13 §6), in the hall's own frame —
 * y = 0 is its floor. Just inside the doorway: the tree left of centre, the
 * history wall behind it, the clerestory at the right edge. PROPOSED.
 */
export const HALL_REST_POSE: CameraPose = {
  position: [-1.0, 1.6, 3.6],
  target: [0, 0.9, -1.5],
};

/**
 * Focus poses. **Composition rule baked into every one: the focused object sits
 * LEFT of centre**, because the DOM detail panel floats in the top-right corner
 * at ~440 px and would otherwise occlude it. If a panel ever sits on a different
 * side, mirror the bias.
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
  // Glide only (A5.1): no panel, so no pose to clear one. The target follows WINDOW_Z.
  window: { position: [0.4, 0.9, 0.9], target: [1.98, 1.0, -0.6] },
  door: { position: [-0.4, 0.7, 1.2], target: [-1.4, -0.74, 0.3] },

  // Follows the tree to its A5.6 spot ([-0.6, 0, 0.2]): the earlier pose,
  // moved with it, so the view onto the tree is the same.
  bonsai: { position: [-0.75, 0.5, 0.85], target: [-0.6, 0.15, 0.2] },
  // The 365-day tracker (3.5). Checked against a render with the panel open,
  // 2026-09-28: the whole band sits left of the panel. A closer camera clipped
  // the band and let monitor 1 fill the frame; a lower target did the same.
  wallGrid: { position: [-0.2, 0.85, 0.9], target: [0, 0.75, -1.2] },

  // The hall (design-system/13 §6), in its own frame. The ids belong to one
  // scene each, so the two sets share this table. PROPOSED, tuned at build.
  hallWall: { position: [2.9, 1.35, 0.6], target: [2.9, 1.3, -1.5] },
  hallTree: { position: [-1.4, 0.7, 1.5], target: [-0.55, 1.25, 0.2] },
};

// ── Portrait ─────────────────────────────────────────────────────────────────
//
// The poses above are composed for a wide frame: object left of centre, panel
// on the right. On a frame taller than it is wide the panel spans the top
// instead, and pushing the object left pushes it off-screen. So in portrait
// the object is centred horizontally and dropped into the lower part of the
// frame, under the panel.
//
// Derived, not hand-tuned, so it holds for any portrait size and field of
// view: the camera keeps the wide pose's viewing ANGLE onto the object, backs
// off until the object fills FILL of the frame's width, and aims above the
// object so its centre sits DROP of the half-height below the middle.

interface FocusSubject {
  /** The visual centre of the object, in world space. */
  centre: [number, number, number];
  /** Its widest extent across the view, in metres. */
  width: number;
}

/**
 * Every object that opens a panel. The glide-only objects (window, door,
 * headphones) keep their wide pose in portrait — there is no panel to clear.
 * Positions mirror scene/RoomScene.tsx and the objects' own geometry.
 */
export const FOCUS_SUBJECTS: Partial<Record<ObjectId, FocusSubject>> = {
  // MONITOR_FILL_POSITIONS x/z; screen centre 0.306 above the desk (Monitor.tsx).
  monitor1: { centre: [-0.3, 0.306, -0.4], width: 0.62 },
  monitor2: { centre: [0.5, 0.306, -0.4], width: 0.62 },
  notebook: { centre: [0.66, 0.007, 0.15], width: 0.27 },
  phone: { centre: [0.45, 0.004, 0.2], width: 0.16 },
  // GRID_CENTRE, a 1.33 m band (WallGrid.tsx).
  wallGrid: { centre: [-0.75, 0.493, -1.2], width: 1.36 },
  // BONSAI_POSITION; at TREE_SCALE the pads span ~0.2 m, centred ~0.16 m up.
  bonsai: { centre: [-0.6, 0.16, 0.2], width: 0.22 },
};

const FILL = 0.8;
const DROP = 0.35;
/**
 * No further than the wide rest pose sits from the desk, so the camera never
 * leaves the room. Only the wall band reaches it: in portrait it is cropped at
 * the sides, and the panel carries its numbers.
 */
const MAX_DISTANCE = 3.0;

export function isPortrait(aspect: number): boolean {
  return aspect < 1;
}

/** The focus pose for `id` on a portrait frame of `aspect` and vertical `fovDeg`. */
export function portraitPose(id: ObjectId, aspect: number, fovDeg: number): CameraPose {
  const wide = FOCUS_POSES[id];
  const subject = FOCUS_SUBJECTS[id];
  if (!subject) return wide;

  const [cx, cy, cz] = subject.centre;
  // Unit vector from the object back toward the wide pose's camera.
  let bx = wide.position[0] - cx;
  let by = wide.position[1] - cy;
  let bz = wide.position[2] - cz;
  const length = Math.hypot(bx, by, bz);
  bx /= length;
  by /= length;
  bz /= length;

  const halfV = (fovDeg * Math.PI) / 360;
  const halfH = Math.atan(Math.tan(halfV) * aspect);
  const distance = Math.min(subject.width / (2 * FILL * Math.tan(halfH)), MAX_DISTANCE);

  // "Up" on screen: world up with its component along the view removed.
  const along = -by; // world up · (camera → object)
  let ux = along * bx;
  let uy = 1 + along * by;
  let uz = along * bz;
  const upLength = Math.hypot(ux, uy, uz);
  ux /= upLength;
  uy /= upLength;
  uz /= upLength;
  const lift = distance * Math.tan(halfV) * DROP;

  return {
    position: [cx + bx * distance, cy + by * distance, cz + bz * distance],
    target: [cx + ux * lift, cy + uy * lift, cz + uz * lift],
  };
}
