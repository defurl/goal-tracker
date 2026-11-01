// The journal on the device: what an entry needs before it saves (J01), the
// check-in answers it may carry, and the week in counts (J04). Pure rules; the
// IndexedDB round trip is pnpm journal:check, in three browsers.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { checkEntry, hasContent, type DeviceEntry } from '../../lib/journal/deviceStore.ts';
import { MIN_TREND_ENTRIES, summariseWeek } from '../../lib/journal/weekly.ts';

function entry(over: Partial<DeviceEntry> = {}): DeviceEntry {
  return {
    id: 'entry-0001',
    ownerId: 'owner-a',
    localDate: '2026-10-30',
    type: 'check-in',
    title: null,
    body: '',
    prompt: null,
    tags: [],
    moods: [],
    energy: null,
    createdAt: '2026-10-30T08:00:00.000Z',
    updatedAt: '2026-10-30T08:00:00.000Z',
    ...over,
  };
}

describe('hasContent (J01: one non-empty field saves)', () => {
  it('refuses a blank entry', () => {
    assert.equal(hasContent(entry()), false);
    assert.equal(hasContent(entry({ body: '   ', fields: { positive: ' ' } })), false);
  });

  it('accepts any one thing: a mood, an energy, an answer, a line', () => {
    assert.equal(hasContent(entry({ moods: ['calm'] })), true);
    assert.equal(hasContent(entry({ energy: 2 })), true);
    assert.equal(hasContent(entry({ fields: { tomorrow: 'Sleep earlier' } })), true);
    assert.equal(hasContent(entry({ body: 'A line' })), true);
  });
});

describe('checkEntry', () => {
  it('accepts the four check-in answers', () => {
    assert.equal(checkEntry(entry({ fields: { positive: 'a', difficult: 'b', lesson: 'c', tomorrow: 'd' } })), null);
  });

  it('refuses an unknown answer or one that is too long', () => {
    assert.equal(checkEntry(entry({ fields: { mystery: 'x' } as never })), 'fields');
    assert.equal(checkEntry(entry({ fields: { positive: 'x'.repeat(2001) } })), 'fields');
  });
});

describe('summariseWeek (J04)', () => {
  const week = [
    entry({ id: 'e-0000001', localDate: '2026-10-30', moods: ['calm', 'tired'], energy: 3, tags: ['work'] }),
    entry({ id: 'e-0000002', localDate: '2026-10-30', moods: ['calm'], energy: 4 }),
    entry({ id: 'e-0000003', localDate: '2026-10-26', tags: ['work', 'rest'] }),
    // Outside the seven days ending 2026-10-30.
    entry({ id: 'e-0000004', localDate: '2026-10-23', moods: ['low'], energy: 1 }),
  ];

  it('counts only the seven days ending on the given date', () => {
    const s = summariseWeek(week, '2026-10-30');
    assert.equal(s.from, '2026-10-24');
    assert.equal(s.entries, 3);
    assert.equal(s.days, 2);
  });

  it('ranks what was recorded and reports the energy sample size', () => {
    const s = summariseWeek(week, '2026-10-30');
    assert.deepEqual(s.moods[0], { key: 'calm', count: 2 });
    assert.deepEqual(s.tags[0], { key: 'work', count: 2 });
    assert.deepEqual(s.energy, { mean: 3.5, samples: 2 });
  });

  it('has no energy figure when none was recorded', () => {
    assert.equal(summariseWeek([entry({ body: 'x' })], '2026-10-30').energy, null);
    assert.ok(MIN_TREND_ENTRIES >= 3);
  });
});
