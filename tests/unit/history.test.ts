// lib/history.ts — one habit's year on the hall's wall, and its streaks by
// log_habit()'s rule (020).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { shiftDate } from '../../lib/dates.ts';
import { HISTORY_DAYS, historyRow, type HabitHistoryInput } from '../../lib/history.ts';

const TODAY = '2026-09-30'; // a Wednesday
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

function habit(kept: string[], over: Partial<HabitHistoryInput> = {}): HabitHistoryInput {
  return {
    id: 'h', name: 'Walk', type: 'build', archived: false, dueDays: EVERY_DAY,
    born: '2025-01-01', storedStreak: 0, storedLongest: 0, kept: new Set(kept), ...over,
  };
}
const daysBack = (n: number) => Array.from({ length: n }, (_, i) => shiftDate(TODAY, -i));

describe('historyRow', () => {
  it('lays out a year, oldest first, with today last', () => {
    const row = historyRow(habit([TODAY, shiftDate(TODAY, -1)]), TODAY);
    assert.equal(row.days.length, HISTORY_DAYS);
    assert.equal(row.days.at(-1), 2, 'kept today is the bright cell');
    assert.equal(row.days.at(-2), 1);
    assert.equal(row.days[0], 0);
    assert.equal(row.keptThisYear, 2);
  });

  it('today not yet kept is a bare cell, and does not break the run', () => {
    const row = historyRow(habit(daysBack(4).slice(1)), TODAY); // the 3 days before today
    assert.equal(row.days.at(-1), 0);
    assert.equal(row.currentStreak, 3);
  });

  it('a missed due day ends the current run', () => {
    const kept = [TODAY, shiftDate(TODAY, -1), shiftDate(TODAY, -3), shiftDate(TODAY, -4)];
    assert.equal(historyRow(habit(kept), TODAY).currentStreak, 2);
  });

  it('a day the habit is not due neither counts nor breaks (weekdays only)', () => {
    // Mon–Fri. Today is Wednesday; Sat and Sun before Monday were not due.
    const kept = ['2026-09-30', '2026-09-29', '2026-09-28', '2026-09-25', '2026-09-24'];
    const row = historyRow(habit(kept, { dueDays: [1, 2, 3, 4, 5] }), TODAY);
    assert.equal(row.currentStreak, 5);
    assert.equal(row.longestStreak, 5);
  });

  it('the day the habit was born is where its run starts', () => {
    const row = historyRow(habit(daysBack(3), { born: shiftDate(TODAY, -2) }), TODAY);
    assert.equal(row.currentStreak, 3);
  });

  it('marks the longest run on the wall, the more recent of two equal ones', () => {
    // Two 3-day runs: days -10..-8 and -3..-1.
    const kept = [-10, -9, -8, -3, -2, -1].map((n) => shiftDate(TODAY, n));
    const row = historyRow(habit(kept), TODAY);
    assert.deepEqual(row.longestRun, { from: HISTORY_DAYS - 4, to: HISTORY_DAYS - 2 });
    assert.equal(row.longestStreak, 3);
  });

  it('the stored longest wins when it is longer than anything on the wall (D-09)', () => {
    const row = historyRow(habit([TODAY], { storedLongest: 40 }), TODAY);
    assert.equal(row.longestStreak, 40);
  });

  it('a run past the start of the year falls back to the stored streak', () => {
    const row = historyRow(habit(daysBack(HISTORY_DAYS), { born: '2024-01-01', storedStreak: 400 }), TODAY);
    assert.equal(row.currentStreak, 400);
  });

  it('an archived habit has no current streak, and keeps its history', () => {
    const row = historyRow(habit(daysBack(5), { archived: true }), TODAY);
    assert.equal(row.currentStreak, 0);
    assert.equal(row.keptThisYear, 5);
    assert.equal(row.longestStreak, 5);
  });

  it('a habit never kept has a bare line, no run, and no error', () => {
    const row = historyRow(habit([]), TODAY);
    assert.equal(row.days.every((d) => d === 0), true);
    assert.equal(row.longestRun, null);
    assert.deepEqual([row.currentStreak, row.longestStreak, row.keptThisYear], [0, 0, 0]);
  });
});
