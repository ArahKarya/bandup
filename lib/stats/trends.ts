import { SKILLS, type Skill } from "@/lib/plan/study-plan";
import { addDays, startOfUtcDay } from "./dates";
import { latestBands, type BandPoint, type SkillBands } from "./bands";

/** Band movement over time, for trend arrows and the weekly recap. */

export const TREND_DAYS = 14;

/** Band estimate per skill using only scores recorded before `cutoff`. */
export function bandsAsOf(points: readonly BandPoint[], cutoff: Date, window = 3): SkillBands {
  return latestBands(
    points.filter((p) => p.createdAt.getTime() < cutoff.getTime()),
    window,
  );
}

/**
 * Change per skill between the estimate `days` ago and now. A skill without an earlier
 * score has no trend (null) rather than a misleading jump from zero.
 */
export function skillTrends(points: readonly BandPoint[], now: Date, days = TREND_DAYS, window = 3): Record<Skill, number | null> {
  const current = latestBands(points, window);
  const before = bandsAsOf(points, addDays(now, -days), window);
  return Object.fromEntries(
    SKILLS.map((s) => {
      const a = before[s];
      const b = current[s];
      return [s, a === undefined || b === undefined ? null : Math.round((b - a) * 10) / 10];
    }),
  ) as Record<Skill, number | null>;
}

/** Mean band across the skills both estimates share; null when they share none. */
export function meanBandChange(before: SkillBands, after: SkillBands): number | null {
  const shared = SKILLS.filter((s) => before[s] !== undefined && after[s] !== undefined);
  if (shared.length === 0) return null;
  const diff = shared.reduce((sum, s) => sum + ((after[s] ?? 0) - (before[s] ?? 0)), 0) / shared.length;
  return Math.round(diff * 10) / 10;
}

/** Whole days since `date` (0 = today); null when there is no date. */
export function daysSince(date: Date | null, today: Date): number | null {
  if (!date) return null;
  return Math.max(0, Math.floor((startOfUtcDay(today).getTime() - startOfUtcDay(date).getTime()) / 86_400_000));
}
