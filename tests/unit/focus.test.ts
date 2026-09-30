// The focus timer (A5.2, D-24 §6): two minutes from turning focus on, counted
// down as m:ss. lib/data/focus.ts ends it with a timeout on FOCUS_MS.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FOCUS_MS, focusPatch, formatRemaining } from '../../lib/focusTimer.ts';

describe('focus timer', () => {
  it('is two minutes', () => {
    assert.equal(FOCUS_MS, 120_000);
  });

  it('on sets the end two minutes out; off clears it', () => {
    assert.deepEqual(focusPatch(true, 1_000), { focusMode: true, focusEndsAt: 121_000 });
    assert.deepEqual(focusPatch(false, 1_000), { focusMode: false, focusEndsAt: null });
  });

  it('formats what is left as m:ss, never below zero', () => {
    assert.equal(formatRemaining(120_000, 0), '2:00');
    assert.equal(formatRemaining(120_000, 500), '2:00');
    assert.equal(formatRemaining(120_000, 61_000), '0:59');
    assert.equal(formatRemaining(120_000, 119_001), '0:01');
    assert.equal(formatRemaining(120_000, 130_000), '0:00');
  });
});
