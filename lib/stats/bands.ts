import { roundOverall } from "@/lib/scoring/band";
import { SKILLS, type Skill } from "@/lib/plan/study-plan";

/** One SkillScore row, reduced to what the band stats need. */
export interface BandPoint {
  skill: string;
  band: number;
  createdAt: Date;
}

export type SkillBands = Partial<Record<Skill, number>>;

/** One row of the band-over-time chart: a date plus the bands recorded on it. */
export interface TimelineRow extends SkillBands {
  date: string;
}

const isSkill = (s: string): s is Skill => (SKILLS as readonly string[]).includes(s);

/** Nearest half band, the granularity IELTS reports in. */
export const roundHalf = (v: number): number => Math.round(v * 2) / 2;

/**
 * Latest band per skill. With `window` > 1 the latest N scores are averaged, so one lucky
 * or unlucky practice set does not swing the estimate a whole band.
 */
export function latestBands(points: readonly BandPoint[], window = 1): SkillBands {
  const size = Math.max(1, Math.floor(window));
  const newestFirst = [...points].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return Object.fromEntries(
    SKILLS.flatMap((skill) => {
      const recent = newestFirst.filter((p) => p.skill === skill).slice(0, size);
      if (recent.length === 0) return [];
      const mean = recent.reduce((sum, p) => sum + p.band, 0) / recent.length;
      return [[skill, roundHalf(mean)]];
    }),
  ) as SkillBands;
}

/** Overall band from the four skills; null until every skill has an estimate. */
export function estimatedOverall(bands: SkillBands): number | null {
  const values = SKILLS.map((s) => bands[s]);
  if (values.some((v) => v === undefined)) return null;
  const defined = values as number[];
  return roundOverall(defined.reduce((a, b) => a + b, 0) / defined.length);
}

/**
 * Chart rows, oldest first, one per day. Several scores for a skill on the same day are
 * averaged so the line shows one point per day rather than a vertical zig-zag.
 */
export function bandTimeline(points: readonly BandPoint[]): TimelineRow[] {
  const byDay = new Map<string, Map<Skill, number[]>>();
  for (const p of points) {
    if (!isSkill(p.skill)) continue;
    const day = p.createdAt.toISOString().slice(0, 10);
    const skills = byDay.get(day) ?? new Map<Skill, number[]>();
    skills.set(p.skill, [...(skills.get(p.skill) ?? []), p.band]);
    byDay.set(day, skills);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, skills]) => ({
      date,
      ...Object.fromEntries([...skills.entries()].map(([s, bands]) => [s, roundHalf(bands.reduce((x, y) => x + y, 0) / bands.length)])),
    }));
}
