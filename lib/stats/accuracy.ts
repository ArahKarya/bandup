import { QUESTION_CATEGORIES, type QuestionCategory } from "@/lib/content/schema";

/** One QuestionResult row, reduced to what accuracy needs. */
export interface AnswerOutcome {
  category: string;
  correct: boolean;
}

export interface CategoryCount {
  correct: number;
  total: number;
}

export interface CategoryStats {
  /** Accuracy 0–1 per category, only for categories with enough answers to mean something. */
  accuracy: Partial<Record<QuestionCategory, number>>;
  counts: Partial<Record<QuestionCategory, CategoryCount>>;
}

/** Fewer answers than this and one slip would read as a weakness. */
export const MIN_ANSWERS = 3;

export type AccuracyTone = "success" | "warning" | "danger";

const isCategory = (c: string): c is QuestionCategory => (QUESTION_CATEGORIES as readonly string[]).includes(c);

export function categoryStats(outcomes: readonly AnswerOutcome[], minAnswers = MIN_ANSWERS): CategoryStats {
  const tally = outcomes.reduce<Map<QuestionCategory, CategoryCount>>((acc, o) => {
    if (!isCategory(o.category)) return acc;
    const prev = acc.get(o.category) ?? { correct: 0, total: 0 };
    return new Map(acc).set(o.category, { correct: prev.correct + (o.correct ? 1 : 0), total: prev.total + 1 });
  }, new Map());

  const kept = [...tally.entries()].filter(([, c]) => c.total >= minAnswers);
  return {
    accuracy: Object.fromEntries(kept.map(([cat, c]) => [cat, c.correct / c.total])),
    counts: Object.fromEntries(kept),
  };
}

/** Categories sorted weakest first; ties keep the one with more answers first. */
export function weakestCategories(stats: CategoryStats, limit = 3): QuestionCategory[] {
  return (Object.entries(stats.accuracy) as [QuestionCategory, number][])
    .sort((a, b) => a[1] - b[1] || (stats.counts[b[0]]?.total ?? 0) - (stats.counts[a[0]]?.total ?? 0))
    .slice(0, limit)
    .map(([c]) => c);
}

/** Colour threshold for an accuracy bar: ≥75 % on track, ≥50 % needs work, else weak. */
export function accuracyTone(accuracy: number): AccuracyTone {
  if (accuracy >= 0.75) return "success";
  if (accuracy >= 0.5) return "warning";
  return "danger";
}
