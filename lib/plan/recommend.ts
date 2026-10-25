import type { QuestionCategory } from "@/lib/content/schema";
import { SKILLS, type PlanActivity, type Skill } from "./study-plan";

/**
 * "Next best step": the single most useful thing to do right now. Pure, so the priority
 * order is unit-tested; the dashboard feeds it facts and renders whatever comes back.
 * It always returns a step — a learner should never land on a dead end.
 */

export type NextStepKind = "resume" | "vocab" | "plan" | "mistakes" | "weak" | "mock" | "lesson" | "practice";

export interface NextStep {
  kind: NextStepKind;
  href: string;
  minutes: number;
  skill?: Skill;
  category?: QuestionCategory;
  /** Count behind the suggestion: words due, open mistakes. */
  count?: number;
  /** Content title (lesson, attempt being resumed). */
  title?: string;
  /** The plan activity, when the step comes from today's plan. */
  activity?: PlanActivity;
}

export interface OpenAttemptFact {
  id: string;
  mode: "practice" | "mock" | "placement" | "drill";
  title: string | null;
}

export interface RecommendInput {
  openAttempt: OpenAttemptFact | null;
  vocabDue: number;
  /** Today's planned activities (empty on a rest day). */
  todayPlan: readonly PlanActivity[];
  /** Today's daily goal is already reached; the plan stops being the top suggestion. */
  goalMet: boolean;
  openMistakes: number;
  weakCategory: QuestionCategory | null;
  weakCategorySkill: Skill | null;
  /** Days since the last submitted mock; null if never. */
  daysSinceMock: number | null;
  /** Submitted practice sets and mocks, to tell a new learner from an established one. */
  submittedSets: number;
  nextLesson: { id: string; title: string; skill: string | null } | null;
  bands: Partial<Record<Skill, number>>;
}

export const VOCAB_THRESHOLD = 10;
export const MISTAKE_THRESHOLD = 5;
export const MOCK_GAP_DAYS = 14;
/** Before this many sets a full 2¾-hour mock is too much to suggest unprompted. */
export const SETS_BEFORE_FIRST_MOCK = 3;

const MOCK_MINUTES = 165;
const SET_MINUTES = 20;

function planHref(a: PlanActivity): string {
  switch (a.kind) {
    case "lesson":
      return "/learn";
    case "vocab":
      return "/vocab/review";
    case "mock":
      return "/mock";
    default:
      if (a.category) return `/practice?category=${encodeURIComponent(a.category)}`;
      return a.skill ? `/practice?skill=${a.skill}` : "/practice";
  }
}

/** Skill with the lowest estimate; unknown skills count as lowest so they get measured. */
export function weakestSkill(bands: Partial<Record<Skill, number>>): Skill {
  return [...SKILLS].sort((a, b) => (bands[a] ?? -1) - (bands[b] ?? -1))[0];
}

function mockDue(input: RecommendInput): boolean {
  if (input.daysSinceMock === null) return input.submittedSets >= SETS_BEFORE_FIRST_MOCK;
  return input.daysSinceMock >= MOCK_GAP_DAYS;
}

export function recommendNext(input: RecommendInput): NextStep {
  const open = input.openAttempt;
  if (open) return { kind: "resume", href: `/attempt/${open.id}`, minutes: SET_MINUTES, title: open.title ?? undefined };

  if (input.vocabDue >= VOCAB_THRESHOLD) {
    return { kind: "vocab", href: "/vocab/review", minutes: Math.max(5, Math.ceil(input.vocabDue / 4)), count: input.vocabDue };
  }

  if (!input.goalMet) {
    // Vocabulary is already covered above; the plan's main activity is the one to start.
    const main = input.todayPlan.find((a) => a.kind !== "vocab") ?? input.todayPlan[0];
    if (main) return { kind: "plan", href: planHref(main), minutes: main.minutes, skill: main.skill, category: main.category, activity: main };
  }

  if (input.openMistakes >= MISTAKE_THRESHOLD) {
    return { kind: "mistakes", href: "/mistakes", minutes: 10, count: input.openMistakes };
  }

  if (input.weakCategory) {
    return {
      kind: "weak",
      href: `/practice?category=${encodeURIComponent(input.weakCategory)}`,
      minutes: SET_MINUTES,
      category: input.weakCategory,
      skill: input.weakCategorySkill ?? undefined,
    };
  }

  if (mockDue(input)) return { kind: "mock", href: "/mock", minutes: MOCK_MINUTES };

  if (input.nextLesson) {
    const skill = SKILLS.find((s) => s === input.nextLesson?.skill);
    return { kind: "lesson", href: `/learn/${input.nextLesson.id}`, minutes: 15, title: input.nextLesson.title, skill };
  }

  const skill = weakestSkill(input.bands);
  return { kind: "practice", href: `/practice?skill=${skill}`, minutes: SET_MINUTES, skill };
}
