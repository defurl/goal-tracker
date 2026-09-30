// Calendar arithmetic on YYYY-MM-DD strings. Pure, no time zone: every date
// here is already a user's local date (lib/data/time.ts makes them).

/** YYYY-MM-DD, `days` before (negative) or after `date`. */
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday — Postgres' extract(dow), which habits.frequency uses (020). */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
