/**
 * An Etc/GMT time zone whose local hour is `hour` right now, for Playwright's
 * `timezoneId`. Signed out, the room reads the browser's zone for `localHour`,
 * so this pins a capture or a check to a sky band whatever the runner's clock
 * says. Etc/GMT signs are inverted: Etc/GMT-5 is UTC+5.
 *
 * Pick an hour inside a band, not at its edge: the zone is chosen once, and a
 * run that crosses the hour moves with it.
 */
export function zoneForHour(hour: number, now: Date = new Date()): string {
  let offset = (((hour - now.getUTCHours()) % 24) + 24) % 24;
  if (offset > 14) offset -= 24;
  return offset === 0 ? 'Etc/UTC' : `Etc/GMT${offset > 0 ? '-' : '+'}${Math.abs(offset)}`;
}
