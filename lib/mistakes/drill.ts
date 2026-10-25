import type { AttemptResult } from "@/lib/attempt/sections";

/** Most questions one notebook drill asks. */
export const DRILL_LIMIT = 20;
/** "Drill N most-missed" from the notebook header. */
export const TOP_MISSED = 10;
/** Most questions "Retry wrong answers" re-asks (what openDrillAttempt accepts). */
export const RETRY_LIMIT = 40;

export interface DrillCandidate {
  setId: string;
  n: number;
  skill: string;
  timesWrong: number;
  lastDrilledAt: Date | null;
  createdAt: Date;
}

const time = (d: Date | null): number => (d ? d.getTime() : Number.NEGATIVE_INFINITY);

/**
 * Drill order: the most often missed first; among equals, the one drilled longest ago (never
 * drilled counts as oldest), then the oldest mistake. Returns a new array.
 */
export function prioritise<T extends DrillCandidate>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      b.timesWrong - a.timesWrong ||
      time(a.lastDrilledAt) - time(b.lastDrilledAt) ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.setId.localeCompare(b.setId) ||
      a.n - b.n,
  );
}

/**
 * The questions for one drill. A drill is a single section with one skill (listening needs
 * its audio player, reading its passage layout), so only the top item's skill is kept.
 */
export function pickDrillItems<T extends DrillCandidate>(items: readonly T[], limit: number = DRILL_LIMIT): { picked: T[]; skipped: number } {
  const ordered = prioritise(items);
  const skill = ordered[0]?.skill;
  const sameSkill = ordered.filter((i) => i.skill === skill);
  const picked = sameSkill.slice(0, Math.max(0, limit));
  return { picked, skipped: items.length - picked.length };
}

export interface WrongItem {
  setId: string;
  n: number;
  skill: string;
}

/** Answered-but-wrong questions of a finished attempt, optionally for one skill. Blanks are not "wrong answers". */
export function wrongAnswered(result: AttemptResult | null | undefined, skill?: string): WrongItem[] {
  if (!result) return [];
  return result.sections
    .filter((s) => !skill || s.skill === skill)
    .flatMap((s) => s.sets.flatMap((set) => set.items.filter((i) => !i.correct && i.given.trim() !== "").map((i) => ({ setId: set.setId, n: i.n, skill: s.skill }))));
}

/** Skills of an attempt that have at least one wrong answered question, in section order. */
export function skillsWithWrong(result: AttemptResult | null | undefined): string[] {
  return [...new Set(wrongAnswered(result).map((w) => w.skill))];
}
