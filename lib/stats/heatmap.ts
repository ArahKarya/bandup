import { addDays, isoDay, startOfUtcDay, startOfUtcWeek } from "./dates";
import type { StudyEntry } from "./study-time";

/** Activity heatmap: one column per week (Monday first), one cell per day. */

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  /** yyyy-mm-dd */
  date: string;
  minutes: number;
  level: HeatLevel;
  /** After today: drawn empty, not counted as a missed day. */
  future: boolean;
}

export interface Heatmap {
  weeks: HeatCell[][];
  totalMinutes: number;
  activeDays: number;
}

export const HEATMAP_WEEKS = 16;

/**
 * Intensity relative to the learner's own daily goal, so a 20-minute day reads as "light"
 * for someone aiming at 90 minutes and as a full day for someone aiming at 20.
 */
export function heatLevel(minutes: number, dailyGoal: number): HeatLevel {
  if (minutes <= 0) return 0;
  const ratio = minutes / Math.max(1, dailyGoal);
  if (ratio < 0.5) return 1;
  if (ratio < 1) return 2;
  if (ratio < 1.5) return 3;
  return 4;
}

/** Sums entries per calendar day (several activities may share a day). */
export function minutesByDay(entries: readonly StudyEntry[]): Map<string, number> {
  return entries.reduce((acc, e) => {
    const key = isoDay(startOfUtcDay(e.day));
    return new Map(acc).set(key, (acc.get(key) ?? 0) + e.minutes);
  }, new Map<string, number>());
}

export function minutesOn(entries: readonly StudyEntry[], day: Date): number {
  return minutesByDay(entries).get(isoDay(startOfUtcDay(day))) ?? 0;
}

export function buildHeatmap(entries: readonly StudyEntry[], today: Date, dailyGoal: number, weeks = HEATMAP_WEEKS): Heatmap {
  const perDay = minutesByDay(entries);
  const todayStart = startOfUtcDay(today).getTime();
  const first = addDays(startOfUtcWeek(today), -7 * (weeks - 1));
  const columns = Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d): HeatCell => {
      const date = addDays(first, w * 7 + d);
      const key = isoDay(date);
      const future = date.getTime() > todayStart;
      const minutes = future ? 0 : (perDay.get(key) ?? 0);
      return { date: key, minutes, level: heatLevel(minutes, dailyGoal), future };
    }),
  );
  const past = columns.flat().filter((c) => !c.future);
  return {
    weeks: columns,
    totalMinutes: past.reduce((s, c) => s + c.minutes, 0),
    activeDays: past.filter((c) => c.minutes > 0).length,
  };
}
