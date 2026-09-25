// The user's local calendar, from their IANA timezone. Every `date` column in
// the schema is the user's LOCAL date (03-data-model.md), so every query that
// asks about "today" must ask in their zone, not the browser's or UTC.

/** YYYY-MM-DD in `timeZone`. en-CA happens to format dates that way. */
export function localDate(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** Seconds since local midnight in `timeZone`. Daily limits reset at the next one. */
export function secondsIntoLocalDay(timeZone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 3600 + get('minute') * 60 + get('second');
}

/** 0–23 in `timeZone`. Drives the window sky plane (spec/05 §5). */
export function localHour(timeZone: string, now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  return Number(hour);
}
