// features/room — where hotspots land on a cover-cropped render, which view a
// URL means, and how the room moves between views (design-system/v2/05-room.md).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { coverRect, onScreen, placePoint } from '../../features/room/geometry.ts';
import { MENU, SUNNY, planMove, viewForPath } from '../../features/room/theme.ts';

describe('coverRect', () => {
  it('fills a 16:9 container exactly', () => {
    assert.deepEqual(coverRect(1440, 810, 2560, 1440), { x: 0, y: 0, w: 1440, h: 810 });
  });

  it('crops the sides of a taller container, centred', () => {
    const r = coverRect(1000, 1000, 2560, 1440);
    assert.equal(r.h, 1000);
    assert.ok(Math.abs(r.w - 1777.78) < 0.01);
    assert.ok(Math.abs(r.x - -388.89) < 0.01);
    assert.equal(r.y, 0);
  });

  it('crops the top and bottom of a wider container', () => {
    const r = coverRect(2400, 900, 2560, 1440);
    assert.equal(r.w, 2400);
    assert.equal(r.x, 0);
    assert.ok(r.y < 0);
  });
});

describe('hotspots', () => {
  it('stay on their object when the container changes shape', () => {
    // The same normalised point lands on the same image pixel at any size.
    for (const [w, h] of [
      [1280, 720],
      [1440, 810],
      [1920, 1080],
      [1024, 768],
    ] as const) {
      const rect = coverRect(w, h, 2560, 1440);
      const p = placePoint(rect, 0.34, 0.66);
      assert.ok(Math.abs((p.x - rect.x) / rect.w - 0.34) < 1e-9);
      assert.ok(Math.abs((p.y - rect.y) / rect.h - 0.66) < 1e-9);
    }
  });

  it('are all on screen at the desktop sizes the handoff tests', () => {
    for (const [w, h] of [
      [1280, 720],
      [1440, 810],
      [1920, 1080],
    ] as const) {
      const rect = coverRect(w, h, SUNNY.overview.width, SUNNY.overview.height);
      for (const spot of SUNNY.hotspots) {
        assert.ok(onScreen(placePoint(rect, spot.x, spot.y), w, h, 40), `${spot.id} at ${w}x${h}`);
      }
    }
  });

  it('cover every module in the menu, each pointing at its route', () => {
    for (const m of MENU) {
      const spot = SUNNY.hotspots.find((h) => h.id === m.view);
      assert.ok(spot, m.view);
      assert.equal(spot.route, m.route);
    }
  });
});

describe('viewForPath', () => {
  it('reads the view from the first path segment', () => {
    assert.equal(viewForPath('/room'), 'home');
    assert.equal(viewForPath('/today'), 'today');
    assert.equal(viewForPath('/journal/abc'), 'journal');
    assert.equal(viewForPath('/self-care'), 'selfcare');
    assert.equal(viewForPath('/settings/privacy'), 'settings');
    assert.equal(viewForPath('/nowhere'), 'home');
  });
});

describe('planMove', () => {
  it('zooms in from Home, out to Home, and crossfades between focus views', () => {
    assert.equal(planMove('home', 'today', false), 'zoom-in');
    assert.equal(planMove('today', 'home', false), 'zoom-out');
    assert.equal(planMove('today', 'skills', false), 'crossfade');
    assert.equal(planMove('today', 'today', false), 'none');
  });

  it('swaps immediately under reduced motion', () => {
    assert.equal(planMove('home', 'today', true), 'swap');
    assert.equal(planMove('today', 'home', true), 'swap');
    assert.equal(planMove('today', 'skills', true), 'swap');
  });
});
