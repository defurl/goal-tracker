// Portrait focus poses: every object that opens a panel must land in frame,
// centred across, in the lower part of the frame, clear of the panel above.
// Projected through a real three.js camera, not re-derived by hand.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';

import { FOCUS_POSES, FOCUS_SUBJECTS, isPortrait, portraitPose } from '../../scene/cameraPoses.ts';
import type { ObjectId } from '../../lib/stores/interaction.ts';

/** Phone (the mobile FOV) and an upright tablet — the sizes that reach the room. */
const FRAMES = [
  { name: 'phone 375x812', width: 375, height: 812, fov: 38 },
  { name: 'tablet 768x1024', width: 768, height: 1024, fov: 38 },
];

const ROOM = { x: [-2, 2], y: [-0.74, 2.3], z: [-1.2, 3.0] } as const;

function project(frame: (typeof FRAMES)[number], id: ObjectId) {
  const pose = portraitPose(id, frame.width / frame.height, frame.fov);
  const camera = new PerspectiveCamera(frame.fov, frame.width / frame.height, 0.01, 50);
  camera.position.set(...pose.position);
  camera.lookAt(new Vector3(...pose.target));
  camera.updateMatrixWorld();

  const subject = FOCUS_SUBJECTS[id]!;
  const centre = new Vector3(...subject.centre);
  // The object's edges across the view: along the camera's right vector.
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const left = centre.clone().addScaledVector(right, -subject.width / 2);
  const rightEdge = centre.clone().addScaledVector(right, subject.width / 2);
  return {
    pose,
    centre: centre.project(camera),
    left: left.project(camera),
    right: rightEdge.project(camera),
  };
}

const ids = Object.keys(FOCUS_SUBJECTS) as ObjectId[];

test('portrait is taller than wide', () => {
  assert.equal(isPortrait(375 / 812), true);
  assert.equal(isPortrait(1600 / 1000), false);
});

for (const frame of FRAMES) {
  for (const id of ids) {
    test(`${frame.name}: ${id} is centred across and below the middle`, () => {
      const { centre } = project(frame, id);
      assert.ok(Math.abs(centre.x) < 0.02, `centre x ${centre.x}`);
      // NDC y runs -1 (bottom) to 1 (top); DROP puts it about a third down.
      assert.ok(centre.y < -0.25 && centre.y > -0.45, `centre y ${centre.y}`);
      assert.ok(centre.z < 1, 'in front of the camera');
    });

    test(`${frame.name}: ${id} fits the width, or is the wall band cropped by the room`, () => {
      const { left, right } = project(frame, id);
      if (id === 'wallGrid') {
        // Capped by MAX_DISTANCE: wider than the frame, but centred on it.
        assert.ok(Math.abs(left.x + right.x) < 0.04);
        return;
      }
      assert.ok(left.x > -1 && right.x < 1, `edges ${left.x} … ${right.x}`);
    });

    test(`${frame.name}: ${id}'s camera stays inside the room`, () => {
      const [x, y, z] = project(frame, id).pose.position;
      assert.ok(x > ROOM.x[0] && x < ROOM.x[1], `x ${x}`);
      assert.ok(y > ROOM.y[0] && y < ROOM.y[1], `y ${y}`);
      assert.ok(z > ROOM.z[0] && z < ROOM.z[1], `z ${z}`);
    });
  }
}

test('glide-only objects keep their wide pose', () => {
  assert.deepEqual(portraitPose('window', 0.46, 38), FOCUS_POSES.window);
});
