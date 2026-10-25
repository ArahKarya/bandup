import { addDays, isoDay, startOfUtcWeek } from "./dates";
import type { BandPoint } from "./bands";
import type { StudyEntry } from "./study-time";
import { bandsAsOf, meanBandChange } from "./trends";

/** Weekly recap: one Monday-to-Sunday week compared with the one before it. */

export interface WeekActivity {
  minutes: number;
  /** Submitted practice sets, drills and mock tests. */
  sets: number;
  correct: number;
  answered: number;
}

export interface WeeklyRecap {
  /** Monday, yyyy-mm-dd. */
  weekStart: string;
  minutes: number;
  minutesDelta: number;
  sets: number;
  setsDelta: number;
  /** 0–1, null when nothing was answered that week. */
  accuracy: number | null;
  /** Percentage points against the previous week; null if either week has no answers. */
  accuracyDelta: number | null;
  /** Mean band change across skills over the week; null without scores on both sides. */
  bandChange: number | null;
}

export interface RecapInput {
  weekStart: Date;
  study: readonly StudyEntry[];
  /** Submission timestamps of practice/drill/mock attempts. */
  submittedAt: readonly Date[];
  /** Answers per week, keyed by Monday (yyyy-mm-dd). */
  answers: ReadonlyMap<string, { correct: number; answered: number }>;
  bandPoints: readonly BandPoint[];
}

function inWeek(d: Date, start: Date): boolean {
  const t = d.getTime();
  return t >= start.getTime() && t < addDays(start, 7).getTime();
}

export function weekActivity(input: RecapInput, start: Date): WeekActivity {
  const answers = input.answers.get(isoDay(start)) ?? { correct: 0, answered: 0 };
  return {
    minutes: input.study.filter((e) => inWeek(e.day, start)).reduce((s, e) => s + e.minutes, 0),
    sets: input.submittedAt.filter((d) => inWeek(d, start)).length,
    ...answers,
  };
}

const ratio = (w: WeekActivity): number | null => (w.answered > 0 ? w.correct / w.answered : null);

export function weeklyRecap(input: RecapInput): WeeklyRecap {
  const start = startOfUtcWeek(input.weekStart);
  const prevStart = addDays(start, -7);
  const now = weekActivity(input, start);
  const prev = weekActivity(input, prevStart);
  const acc = ratio(now);
  const prevAcc = ratio(prev);
  return {
    weekStart: isoDay(start),
    minutes: now.minutes,
    minutesDelta: now.minutes - prev.minutes,
    sets: now.sets,
    setsDelta: now.sets - prev.sets,
    accuracy: acc,
    accuracyDelta: acc === null || prevAcc === null ? null : Math.round((acc - prevAcc) * 100),
    bandChange: meanBandChange(bandsAsOf(input.bandPoints, start), bandsAsOf(input.bandPoints, addDays(start, 7))),
  };
}

/** The dashboard shows last week's recap on Mondays only; the progress page always does. */
export function isRecapDay(today: Date): boolean {
  return today.getUTCDay() === 1;
}
