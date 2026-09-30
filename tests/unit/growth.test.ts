// lib/growth.ts — the one place points become leaves (spec/05 §4). The bonsai
// and /text both read it, so this holds the curve both of them show.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MAX_LEAVES, leafCountForPoints } from '../../lib/growth.ts';

describe('leafCountForPoints', () => {
  it('grows nothing before the first threshold', () => {
    assert.equal(leafCountForPoints(0), 0);
    assert.equal(leafCountForPoints(19), 0);
  });

  it('adds a leaf at each early threshold: 20, 45, 70, 100', () => {
    assert.deepEqual(
      [20, 44, 45, 69, 70, 99, 100].map(leafCountForPoints),
      [1, 1, 2, 2, 3, 3, 4],
    );
  });

  it('then one leaf per 100 points', () => {
    assert.equal(leafCountForPoints(199), 4);
    assert.equal(leafCountForPoints(200), 5);
    assert.equal(leafCountForPoints(1_000), 13);
  });

  it('stops at MAX_LEAVES, the size of the InstancedMesh', () => {
    assert.equal(MAX_LEAVES, 64);
    assert.equal(leafCountForPoints(1_000_000), MAX_LEAVES);
  });

  it('never shrinks as points rise (D-08: there is no negative row)', () => {
    let previous = 0;
    for (let total = 0; total <= 7_000; total += 5) {
      const leaves = leafCountForPoints(total);
      assert.ok(leaves >= previous, `${total} points gave ${leaves} after ${previous}`);
      previous = leaves;
    }
  });

  it('reads anything that is not a real total as no leaves, never as an error', () => {
    for (const total of [-5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(leafCountForPoints(total), 0, String(total));
    }
  });
});
