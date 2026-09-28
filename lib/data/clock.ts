// Keeps `localHour` true while the room is open (spec/05 §5, build plan 3.7).
//
// hydrate() sets the hour once; without this the window would hold the hour
// the page loaded in for as long as the tab stays open. The data layer is the
// store's only writer (spec/05 §6), so the clock lives here, not in the scene.
//
// Once a minute is plenty: the sky lerps between bands over a couple of
// seconds, so a band change lands within a minute of the hour and eases in.
// The zone is the signed-in user's profile zone, else the visitor's own.

import { useAppStore } from '../stores/app';
import { getSession } from './session';
import { browserTimeZone, localHour } from './time';
import { write } from './write';

const TICK_MS = 60_000;

export function watchClock(): () => void {
  const tick = () => {
    const hour = localHour(getSession()?.timeZone ?? browserTimeZone());
    if (useAppStore.getState().localHour !== hour) write({ localHour: hour });
  };
  const id = setInterval(tick, TICK_MS);
  return () => clearInterval(id);
}
