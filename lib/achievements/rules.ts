/**
 * Achievement rules as plain data. Each rule reads a snapshot of the learner's stats and
 * reports progress toward a goal; reaching the goal earns the badge. Keeping the rules
 * pure means they are unit-tested and the server only has to build the snapshot.
 */

export type LessonSkill = "listening" | "reading" | "writing" | "speaking";
export const LESSON_SKILLS: readonly LessonSkill[] = ["listening", "reading", "writing", "speaking"];

export interface AchievementSnapshot {
  practiceSets: number;
  mocks: number;
  drills: number;
  placementDone: boolean;
  /** Current run of consecutive study days. */
  streak: number;
  /** Cards recalled at least twice in a row (SM-2 reps ≥ 2). */
  wordsLearned: number;
  lessons: Record<LessonSkill, { done: number; total: number }>;
  /** Highest single band recorded in any test skill. */
  bestBand: number | null;
  mistakesMastered: number;
  minutesTotal: number;
}

export type AchievementIcon =
  | "footprints"
  | "clipboard"
  | "compass"
  | "flame"
  | "book"
  | "graduation"
  | "star"
  | "crown"
  | "check"
  | "dumbbell"
  | "clock";

export type AchievementGroup = "start" | "habit" | "vocab" | "lessons" | "bands" | "practice";

/** How the progress hint is worded ("4/7 days"). */
export type ProgressUnit = "days" | "words" | "lessons" | "hours" | "band" | "count";

export interface AchievementRule {
  key: string;
  group: AchievementGroup;
  icon: AchievementIcon;
  unit: ProgressUnit;
  /** Progress toward the goal; `current >= goal` means earned. */
  progress: (s: AchievementSnapshot) => { current: number; goal: number };
}

export const WORD_REPS_LEARNED = 2;

const count = (
  key: string,
  group: AchievementGroup,
  icon: AchievementIcon,
  unit: ProgressUnit,
  goal: number,
  read: (s: AchievementSnapshot) => number,
): AchievementRule => ({
  key,
  group,
  icon,
  unit,
  progress: (s) => ({ current: Math.min(goal, read(s)), goal }),
});

/** Progress toward a band milestone is the best band so far, capped at the goal. */
const band = (key: string, goal: number): AchievementRule => ({
  key,
  group: "bands",
  icon: goal >= 7 ? "crown" : "star",
  unit: "band",
  progress: (s) => ({ current: Math.min(goal, s.bestBand ?? 0), goal }),
});

const lessons = (skill: LessonSkill, key: string): AchievementRule => ({
  key,
  group: "lessons",
  icon: "graduation",
  unit: "lessons",
  // A skill without lessons cannot be completed, so it stays locked at 0/1.
  progress: (s) => {
    const { done, total } = s.lessons[skill];
    return total === 0 ? { current: 0, goal: 1 } : { current: Math.min(total, done), goal: total };
  },
});

export const RULES: readonly AchievementRule[] = [
  count("firstPractice", "start", "footprints", "count", 1, (s) => s.practiceSets),
  count("placementDone", "start", "compass", "count", 1, (s) => (s.placementDone ? 1 : 0)),
  count("firstMock", "start", "clipboard", "count", 1, (s) => s.mocks),
  count("streak3", "habit", "flame", "days", 3, (s) => s.streak),
  count("streak7", "habit", "flame", "days", 7, (s) => s.streak),
  count("streak30", "habit", "flame", "days", 30, (s) => s.streak),
  count("hours10", "habit", "clock", "hours", 10, (s) => Math.floor(s.minutesTotal / 60)),
  count("words50", "vocab", "book", "words", 50, (s) => s.wordsLearned),
  count("words100", "vocab", "book", "words", 100, (s) => s.wordsLearned),
  count("words300", "vocab", "book", "words", 300, (s) => s.wordsLearned),
  lessons("listening", "lessonsListening"),
  lessons("reading", "lessonsReading"),
  lessons("writing", "lessonsWriting"),
  lessons("speaking", "lessonsSpeaking"),
  band("band65", 6.5),
  band("band70", 7),
  count("drills10", "practice", "dumbbell", "count", 10, (s) => s.drills),
  count("mistakes10", "practice", "check", "count", 10, (s) => s.mistakesMastered),
];

export const RULE_KEYS: readonly string[] = RULES.map((r) => r.key);

export function isEarned(rule: AchievementRule, s: AchievementSnapshot): boolean {
  const { current, goal } = rule.progress(s);
  return current >= goal;
}

/** Keys the snapshot qualifies for, in rule order. */
export function earnedKeys(s: AchievementSnapshot): string[] {
  return RULES.filter((r) => isEarned(r, s)).map((r) => r.key);
}

/** Keys earned now that are not yet stored. */
export function newlyEarned(s: AchievementSnapshot, alreadyEarned: Iterable<string>): string[] {
  const have = new Set(alreadyEarned);
  return earnedKeys(s).filter((k) => !have.has(k));
}

export interface AchievementView {
  rule: AchievementRule;
  earnedAt: Date | null;
  current: number;
  goal: number;
  /** 0–1 */
  ratio: number;
}

/** Every rule with its state, in rule order (rules are grouped, so the grid reads by theme). */
export function achievementViews(s: AchievementSnapshot, earned: ReadonlyMap<string, Date>): AchievementView[] {
  return RULES.map((rule): AchievementView => {
    const { current, goal } = rule.progress(s);
    const earnedAt = earned.get(rule.key) ?? null;
    // Once earned a badge stays earned, even if the streak behind it later breaks.
    return { rule, earnedAt, current: earnedAt ? goal : current, goal, ratio: earnedAt ? 1 : goal > 0 ? current / goal : 0 };
  });
}

export function emptySnapshot(): AchievementSnapshot {
  return {
    practiceSets: 0,
    mocks: 0,
    drills: 0,
    placementDone: false,
    streak: 0,
    wordsLearned: 0,
    lessons: { listening: { done: 0, total: 0 }, reading: { done: 0, total: 0 }, writing: { done: 0, total: 0 }, speaking: { done: 0, total: 0 } },
    bestBand: null,
    mistakesMastered: 0,
    minutesTotal: 0,
  };
}
