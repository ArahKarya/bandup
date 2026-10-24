/**
 * Calendar-day arithmetic. A day is represented as a Date at 00:00 UTC carrying the
 * learner's *local* calendar date (see `calendarToday`), and StudyLog rows use the same
 * labels, so all grouping by day or week below can use plain UTC maths without a learner
 * in Jakarta seeing "today" roll over at 07:00.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** IANA zone used for "today"; one per deployment (most installs serve one country). */
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Jakarta";

/** Today's date in `timeZone`, as a 00:00 UTC day label. */
export function calendarToday(now: Date = new Date(), timeZone: string = APP_TIMEZONE): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** yyyy-mm-dd of the UTC day. */
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/** Monday 00:00 UTC of the week containing `d` (ISO weeks start on Monday). */
export function startOfUtcWeek(d: Date): Date {
  const day = startOfUtcDay(d);
  const offset = (day.getUTCDay() + 6) % 7;
  return addDays(day, -offset);
}

/** Whole days from today to the exam; 0 on exam day, negative once it has passed. */
export function daysUntil(examDate: Date, today: Date): number {
  return Math.round((startOfUtcDay(examDate).getTime() - startOfUtcDay(today).getTime()) / DAY_MS);
}

/** Short date in the UI language; UTC so a yyyy-mm-dd day never shifts by one. */
export function formatDay(d: Date | string, locale: string, withYear = true): string {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00Z`) : d;
  return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-GB", {
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(date);
}
