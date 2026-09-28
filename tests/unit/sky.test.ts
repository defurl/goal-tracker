// spec/05 §5: which band each hour falls in, and that every hour has one.

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SKY_STATES, skyBand } from '../../lib/sky.ts';

test('every band starts on its hour', () => {
  assert.equal(skyBand(22), 'night');
  assert.equal(skyBand(5), 'dawn');
  assert.equal(skyBand(8), 'day');
  assert.equal(skyBand(17), 'dusk');
  assert.equal(skyBand(20), 'evening');
});

test('night wraps past midnight', () => {
  for (const hour of [22, 23, 0, 1, 4]) assert.equal(skyBand(hour), 'night', `hour ${hour}`);
});

test('the hour before each boundary is still the earlier band', () => {
  assert.equal(skyBand(4), 'night');
  assert.equal(skyBand(7), 'dawn');
  assert.equal(skyBand(16), 'day');
  assert.equal(skyBand(19), 'dusk');
  assert.equal(skyBand(21), 'evening');
});

test('every hour of the day maps to a defined state', () => {
  for (let hour = 0; hour < 24; hour++) {
    const state = SKY_STATES[skyBand(hour)];
    assert.ok(state && state.intensity > 0, `hour ${hour}`);
  }
});
