// lib/leafSchedule.ts — how the bonsai's earned leaves arrive (A5.5): a
// droplet each, one at a time, never two in the air at once.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DROP_MS, LEAF_STAGGER_MS, REVEAL_MS, dropProgress, scheduleLeaves } from '../../lib/leafSchedule.ts';

describe('scheduleLeaves', () => {
  it('one leaf: its droplet falls now, and it grows as the droplet lands', () => {
    assert.deepEqual(scheduleLeaves(1, 1_000, null), [{ dropAt: 1_000, revealAt: 1_000 + DROP_MS }]);
  });

  it('several leaves come one at a time, a droplet each', () => {
    const runs = scheduleLeaves(3, 0, null);
    assert.deepEqual(runs.map((r) => r.dropAt), [0, LEAF_STAGGER_MS, 2 * LEAF_STAGGER_MS]);
    for (const run of runs) assert.equal(run.revealAt, run.dropAt + DROP_MS);
  });

  it('never has two droplets in the air', () => {
    assert.ok(LEAF_STAGGER_MS > DROP_MS);
  });

  it('keeps to the motion range: slow, never a wait (03-motion.md, 600–2200 ms)', () => {
    assert.ok(LEAF_STAGGER_MS >= 600 && LEAF_STAGGER_MS <= 2200);
    assert.equal(REVEAL_MS, 900);
  });

  it('leaves earned while a run is still going queue after it', () => {
    const [next] = scheduleLeaves(1, 100, 1_200);
    assert.equal(next?.dropAt, 1_200 + LEAF_STAGGER_MS);
  });

  it('a run long finished does not delay the next leaf', () => {
    const [next] = scheduleLeaves(1, 10_000, 1_200);
    assert.equal(next?.dropAt, 10_000);
  });

  it('nothing to schedule for no new leaves', () => {
    assert.deepEqual(scheduleLeaves(0, 0, null), []);
  });
});

describe('dropProgress', () => {
  it('runs 0 → 1 over DROP_MS, and is null before and after', () => {
    assert.equal(dropProgress(undefined, 0), null);
    assert.equal(dropProgress(100, 50), null);
    assert.equal(dropProgress(100, 100), 0);
    assert.equal(dropProgress(100, 100 + DROP_MS / 2), 0.5);
    assert.equal(dropProgress(100, 100 + DROP_MS), null);
  });
});
