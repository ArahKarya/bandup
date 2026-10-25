import type { QuestionCategory } from "@/lib/content/schema";

/**
 * Builds a weekly study plan from the learner's target, exam date and current estimates.
 *
 * The plan is a heuristic, not an oracle: the skill furthest below target gets the most
 * sessions, the weakest question types get targeted drills, and the final weeks shift to
 * full mock tests. It is regenerated whenever the learner's scores move.
 */

export type Skill = "listening" | "reading" | "writing" | "speaking";
export const SKILLS: readonly Skill[] = ["listening", "reading", "writing", "speaking"];

export type ActivityKind = "lesson" | "practice" | "vocab" | "mock" | "review";

export interface PlanActivity {
  kind: ActivityKind;
  skill?: Skill;
  category?: QuestionCategory;
  minutes: number;
  label: string;
}

export interface PlanDay {
  /** ISO date, yyyy-mm-dd. */
  date: string;
  activities: PlanActivity[];
}

export interface PlanWeek {
  index: number;
  focus: string;
  days: PlanDay[];
}

export interface PlanInput {
  today: Date;
  examDate: Date | null;
  targetBand: number;
  dailyMinutes: number;
  /** Latest estimate per skill; missing skills are treated as unknown (one band below target). */
  bands: Partial<Record<Skill, number>>;
  /** Accuracy 0–1 per question category, from recent attempts. */
  categoryAccuracy: Partial<Record<QuestionCategory, number>>;
  /** Days of the week (0 = Sunday) the learner studies. */
  studyDays?: number[];
}

export interface StudyPlan {
  weeksUntilExam: number | null;
  gaps: Record<Skill, number>;
  weeks: PlanWeek[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WEEKS = 8;
const MAX_WEEKS = 16;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function skillGaps(input: Pick<PlanInput, "bands" | "targetBand">): Record<Skill, number> {
  return Object.fromEntries(
    SKILLS.map((s) => [s, Math.max(0, input.targetBand - (input.bands[s] ?? input.targetBand - 1))]),
  ) as Record<Skill, number>;
}

/** Categories with at least some data, weakest first, below 75 % accuracy. */
export function weakCategories(acc: PlanInput["categoryAccuracy"], limit = 4): QuestionCategory[] {
  return (Object.entries(acc) as [QuestionCategory, number][])
    .filter(([c, a]) => a < 0.75 && c !== "grammar")
    .sort((a, b) => a[1] - b[1])
    .slice(0, limit)
    .map(([c]) => c);
}

const READING_CATEGORIES = new Set<QuestionCategory>([
  "true_false_not_given",
  "yes_no_not_given",
  "matching_headings",
  "matching_information",
  "matching_sentence_endings",
  "summary_completion",
]);

/** Which skill a category is drilled in, for labelling. */
function categorySkill(c: QuestionCategory): Skill {
  return READING_CATEGORIES.has(c) ? "reading" : "listening";
}

/** Skills ordered so that larger gaps appear more often (a weighted round-robin). */
export function skillRotation(gaps: Record<Skill, number>, length: number): Skill[] {
  const weights = SKILLS.map((s) => ({ s, w: 1 + gaps[s] * 2 }));
  const credit = new Map(SKILLS.map((s) => [s, 0]));
  const out: Skill[] = [];
  for (let i = 0; i < length; i++) {
    for (const { s, w } of weights) credit.set(s, (credit.get(s) ?? 0) + w);
    const next = [...credit.entries()].sort((a, b) => b[1] - a[1])[0][0];
    credit.set(next, (credit.get(next) ?? 0) - weights.reduce((t, x) => t + x.w, 0));
    out.push(next);
  }
  return out;
}

export function buildStudyPlan(input: PlanInput): StudyPlan {
  const today = startOfDay(input.today);
  const studyDays = input.studyDays?.length ? input.studyDays : [1, 2, 3, 4, 5, 6];
  const gaps = skillGaps(input);
  const weak = weakCategories(input.categoryAccuracy);

  const daysLeft = input.examDate ? Math.ceil((startOfDay(input.examDate).getTime() - today.getTime()) / DAY_MS) : null;
  const weeksUntilExam = daysLeft === null ? null : Math.max(0, Math.ceil(daysLeft / 7));
  const weekCount = Math.min(MAX_WEEKS, Math.max(1, weeksUntilExam ?? DEFAULT_WEEKS));

  const totalSlots = weekCount * studyDays.length;
  const rotation = skillRotation(gaps, totalSlots);
  const minutes = Math.max(20, input.dailyMinutes);

  const weeks: PlanWeek[] = [];
  let slot = 0;
  let weakIndex = 0;

  for (let w = 0; w < weekCount; w++) {
    const remaining = weekCount - w;
    const phase = remaining <= 1 ? "final" : remaining <= 3 ? "exam" : w === 0 ? "foundation" : "build";
    const days: PlanDay[] = [];

    const examStart = input.examDate ? startOfDay(input.examDate).getTime() : Infinity;
    const dates = Array.from({ length: 7 }, (_, d) => new Date(today.getTime() + (w * 7 + d) * DAY_MS)).filter(
      (date) => date.getTime() < examStart && studyDays.includes(date.getUTCDay()),
    );

    dates.forEach((date, i) => {
      const skill = rotation[slot++ % rotation.length];
      const activities: PlanActivity[] = [];

      // The last study day of an exam-phase week is a full mock; the rest stay skill work.
      if ((phase === "exam" || phase === "final") && i === dates.length - 1) {
        activities.push({ kind: "mock", minutes: 165, label: "Full mock test (timed)" });
      } else {
        if (phase === "foundation") {
          activities.push({ kind: "lesson", skill, minutes: Math.round(minutes * 0.4), label: `${cap(skill)} strategy lesson` });
        }
        const weakCat = weak.length && (skill === "reading" || skill === "listening") ? weak[weakIndex++ % weak.length] : undefined;
        activities.push(
          weakCat
            ? {
                kind: "practice",
                skill: categorySkill(weakCat),
                category: weakCat,
                minutes: Math.round(minutes * 0.6),
                label: `Drill: ${humanCategory(weakCat)}`,
              }
            : { kind: "practice", skill, minutes: Math.round(minutes * 0.6), label: `${cap(skill)} practice` },
        );
      }
      activities.push({ kind: "vocab", minutes: 10, label: "Vocabulary review" });
      days.push({ date: isoDate(date), activities });
    });

    weeks.push({ index: w + 1, focus: FOCUS[phase], days });
  }

  return { weeksUntilExam, gaps, weeks };
}

const FOCUS = {
  foundation: "Foundations: learn the format and strategies",
  build: "Build skills: targeted practice on weak areas",
  exam: "Exam practice: timed sections and mock tests",
  final: "Final week: mock test, review mistakes, rest",
} as const;

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const CATEGORY_LABELS: Record<string, string> = {
  true_false_not_given: "True / False / Not Given",
  yes_no_not_given: "Yes / No / Not Given",
  flow_chart_completion: "Flow-chart completion",
  advantages_disadvantages: "Advantages & disadvantages",
  problem_solution: "Problem & solution",
  two_part: "Two-part question",
};

/** Display name for a question category or writing task type. */
export function humanCategory(c: string): string {
  return CATEGORY_LABELS[c] ?? cap(c.replace(/_/g, " "));
}
