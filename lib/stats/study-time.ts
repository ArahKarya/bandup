import { addDays, isoDay, startOfUtcDay, startOfUtcWeek } from "./dates";

/** One StudyLog row, reduced to what the time stats need. */
export interface StudyEntry {
  day: Date;
  minutes: number;
}

export interface WeekMinutes {
  /** Monday of the week, yyyy-mm-dd. */
  weekStart: string;
  minutes: number;
}

/**
 * Consecutive study days ending today. Today may still be empty — the streak is only
 * broken once a whole day passes without study, so a morning check-in does not show 0.
 */
export function computeStreak(days: readonly Date[], today: Date): number {
  const studied = new Set(days.map((d) => isoDay(startOfUtcDay(d))));
  const todayStart = startOfUtcDay(today);
  let cursor = studied.has(isoDay(todayStart)) ? todayStart : addDays(todayStart, -1);
  let streak = 0;
  while (studied.has(isoDay(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Minutes logged from Monday of the current week up to and including today. */
export function minutesThisWeek(entries: readonly StudyEntry[], today: Date): number {
  const from = startOfUtcWeek(today).getTime();
  const to = addDays(startOfUtcDay(today), 1).getTime();
  return entries
    .filter((e) => e.day.getTime() >= from && e.day.getTime() < to)
    .reduce((sum, e) => sum + e.minutes, 0);
}

/** Total minutes per week for the last `weeks` weeks, oldest first, empty weeks included. */
export function weeklyMinutes(entries: readonly StudyEntry[], today: Date, weeks = 8): WeekMinutes[] {
  const current = startOfUtcWeek(today);
  const starts = Array.from({ length: weeks }, (_, i) => addDays(current, -7 * (weeks - 1 - i)));
  return starts.map((start) => {
    const from = start.getTime();
    const to = addDays(start, 7).getTime();
    const minutes = entries
      .filter((e) => e.day.getTime() >= from && e.day.getTime() < to)
      .reduce((sum, e) => sum + e.minutes, 0);
    return { weekStart: isoDay(start), minutes };
  });
}
