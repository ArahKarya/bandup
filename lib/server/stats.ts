import "server-only";

import { cache } from "react";
import { db } from "./db";
import { getProfile } from "./profile";
import { buildStudyPlan, type StudyPlan } from "@/lib/plan/study-plan";
import { PLACEMENT_ID } from "@/lib/attempt/sections";
import { APP_TIMEZONE, addDays, calendarToday, isoDay, startOfUtcDay, startOfUtcWeek } from "@/lib/stats/dates";
import { bandTimeline, estimatedOverall, latestBands, type SkillBands, type TimelineRow } from "@/lib/stats/bands";
import { categoryStats, type CategoryStats } from "@/lib/stats/accuracy";
import { computeStreak, minutesThisWeek, weeklyMinutes, type StudyEntry, type WeekMinutes } from "@/lib/stats/study-time";
import { HEATMAP_WEEKS } from "@/lib/stats/heatmap";
import { weeklyRecap, type WeeklyRecap } from "@/lib/stats/recap";
import { zonedTime } from "@/lib/stats/ics";
import type { BandPoint } from "@/lib/stats/bands";
import type { AttemptMode, ContentKind } from "@/generated/prisma/client";

/**
 * Read-only learner statistics shared by the dashboard, progress and plan pages. The
 * arithmetic lives in lib/stats (pure, unit-tested); this file only fetches rows.
 */

/** Scores averaged per skill for the headline estimate — smooths one-off results. */
export const SMOOTHING_WINDOW = 3;
const ACCURACY_DAYS = 90;
const CHART_WEEKS = 8;

export { estimatedOverall };

/** Latest band per skill (mean of the last `window` scores). Grammar is not a test skill. */
export const getLatestBands = cache(async (userId: string, window = SMOOTHING_WINDOW): Promise<SkillBands> => {
  // One small query per skill, so a long run of Reading practice cannot push Writing out of view.
  const perSkill = await Promise.all(
    (["listening", "reading", "writing", "speaking"] as const).map((skill) =>
      db.skillScore.findMany({
        where: { userId, skill },
        orderBy: { createdAt: "desc" },
        take: window,
        select: { skill: true, band: true, createdAt: true },
      }),
    ),
  );
  return latestBands(perSkill.flat(), window);
});

/** Every test-skill score, oldest first: the band chart, trend arrows and recap read it. */
export const getBandPoints = cache(async (userId: string): Promise<BandPoint[]> =>
  db.skillScore.findMany({
    where: { userId, skill: { not: "grammar" } },
    orderBy: { createdAt: "asc" },
    select: { skill: true, band: true, createdAt: true },
  }),
);

export async function getBandTimeline(userId: string): Promise<TimelineRow[]> {
  return bandTimeline(await getBandPoints(userId));
}

export const getCategoryStats = cache(async (userId: string, today: Date = calendarToday()): Promise<CategoryStats> => {
  const rows = await db.questionResult.findMany({
    where: { userId, createdAt: { gte: addDays(startOfUtcDay(today), -ACCURACY_DAYS) } },
    select: { category: true, correct: true },
  });
  return categoryStats(rows);
});

export interface StudyTimeStats {
  streak: number;
  minutesThisWeek: number;
  weekly: WeekMinutes[];
}

export async function getStudyTime(userId: string, today: Date = calendarToday()): Promise<StudyTimeStats> {
  const since = addDays(startOfUtcWeek(today), -7 * (CHART_WEEKS - 1));
  const [recent, days] = await Promise.all([
    db.studyLog.findMany({ where: { userId, day: { gte: since } }, select: { day: true, minutes: true } }),
    // The streak can outlast the chart window, so it reads distinct days separately.
    db.studyLog.findMany({ where: { userId, minutes: { gt: 0 } }, distinct: ["day"], orderBy: { day: "desc" }, take: 400, select: { day: true } }),
  ]);
  return {
    streak: computeStreak(days.map((d) => d.day), today),
    minutesThisWeek: minutesThisWeek(recent, today),
    weekly: weeklyMinutes(recent, today, CHART_WEEKS),
  };
}

export async function getVocabDueCount(userId: string, now: Date = new Date()): Promise<number> {
  return db.vocabReview.count({ where: { userId, due: { lte: now } } });
}

export interface AttemptSummary {
  id: string;
  mode: AttemptMode;
  contentKind: ContentKind;
  /** Content title; null for the placement test, which has no content row. */
  title: string | null;
  rawScore: number | null;
  maxScore: number | null;
  /** Overall band if the attempt has one, else the single skill band. */
  band: number | null;
  /** The content's skill; null for mocks and the placement test, which span several. */
  skill: string | null;
  submittedAt: Date;
}

export async function getRecentAttempts(userId: string, limit = 8): Promise<AttemptSummary[]> {
  const rows = await db.attempt.findMany({
    where: { userId, status: "submitted", submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" },
    take: limit,
    select: { id: true, mode: true, contentId: true, contentKind: true, rawScore: true, maxScore: true, bands: true, submittedAt: true },
  });
  const meta = await contentMetaFor(rows.map((r) => r.contentId));
  return rows.map((r) => ({
    id: r.id,
    mode: r.mode,
    contentKind: r.contentKind,
    title: r.contentId === PLACEMENT_ID ? null : (meta.get(r.contentId)?.title ?? r.contentId),
    rawScore: r.rawScore,
    maxScore: r.maxScore,
    band: headlineBand(r.bands),
    skill: r.mode === "mock" || r.contentId === PLACEMENT_ID ? null : (meta.get(r.contentId)?.skill ?? null),
    submittedAt: r.submittedAt ?? new Date(0),
  }));
}

/** Title and skill for content ids, including unpublished items so history keeps its labels. */
async function contentMetaFor(ids: readonly string[]): Promise<Map<string, { title: string; skill: string | null }>> {
  if (ids.length === 0) return new Map();
  const rows = await db.contentItem.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, title: true, skill: true } });
  return new Map(rows.map((r) => [r.id, { title: r.title, skill: r.skill }]));
}

/** Titles for content ids, including unpublished items so history keeps its labels. */
export async function titlesFor(ids: readonly string[]): Promise<Map<string, string>> {
  const meta = await contentMetaFor(ids);
  return new Map([...meta.entries()].map(([id, m]) => [id, m.title]));
}

/** `bands` is free-form JSON: `{ overall?, listening?, reading?, ... }`. */
function headlineBand(bands: unknown): number | null {
  if (!bands || typeof bands !== "object") return null;
  const record = bands as Record<string, unknown>;
  if (typeof record.overall === "number") return record.overall;
  // Several skills but no overall yet (a mock awaiting Writing/Speaking scores): nothing to headline.
  const values = Object.values(record).filter((v): v is number => typeof v === "number");
  return values.length === 1 ? values[0] : null;
}

export async function hasPlacement(userId: string, startingBand: number | null): Promise<boolean> {
  if (startingBand !== null) return true;
  return (await db.skillScore.count({ where: { userId } })) > 0;
}

export async function studyPlanFor(userId: string, today: Date = calendarToday()): Promise<StudyPlan> {
  const [profile, bands, stats] = await Promise.all([getProfile(userId), getLatestBands(userId), getCategoryStats(userId, today)]);
  // Before any skill score exists, the placement estimate stands in for every skill.
  const seeded: SkillBands =
    Object.keys(bands).length === 0 && profile.startingBand !== null
      ? { listening: profile.startingBand, reading: profile.startingBand, writing: profile.startingBand, speaking: profile.startingBand }
      : bands;
  // A past exam date would yield an empty plan; fall back to the default length instead.
  const examDate = profile.examDate && startOfUtcDay(profile.examDate) >= startOfUtcDay(today) ? profile.examDate : null;
  return buildStudyPlan({
    today,
    examDate,
    targetBand: profile.targetBand,
    dailyMinutes: profile.dailyMinutes,
    bands: seeded,
    categoryAccuracy: stats.accuracy,
    studyDays: profile.studyDays,
  });
}

export interface SubmissionSummary {
  id: string;
  /** Writing task number (1/2) or speaking part (1–3). */
  number: number;
  title: string;
  /** Band from the most recent score, AI or self-assessed; null until assessed. */
  band: number | null;
  createdAt: Date;
}

const HISTORY_LIMIT = 50;

export async function getWritingHistory(userId: string): Promise<SubmissionSummary[]> {
  const rows = await db.writingSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { id: true, task: true, taskId: true, createdAt: true, scores: { orderBy: { createdAt: "desc" }, take: 1, select: { band: true } } },
  });
  const titles = await titlesFor(rows.map((r) => r.taskId));
  return rows.map((r) => ({ id: r.id, number: r.task, title: titles.get(r.taskId) ?? r.taskId, band: r.scores[0]?.band ?? null, createdAt: r.createdAt }));
}

export async function getSpeakingHistory(userId: string): Promise<SubmissionSummary[]> {
  const rows = await db.speakingSubmission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { id: true, part: true, taskId: true, createdAt: true, scores: { orderBy: { createdAt: "desc" }, take: 1, select: { band: true } } },
  });
  const titles = await titlesFor(rows.map((r) => r.taskId));
  return rows.map((r) => ({ id: r.id, number: r.part, title: titles.get(r.taskId) ?? r.taskId, band: r.scores[0]?.band ?? null, createdAt: r.createdAt }));
}

export interface AdminStats {
  users: number;
  activeLearners: number;
  attemptsWeek: number;
  submissions: number;
  submissionsWeek: number;
}

/** Install-wide usage for the admin overview; "active" means studied in the last 7 days. */
export async function getAdminStats(now: Date = new Date()): Promise<AdminStats> {
  const weekAgo = addDays(now, -7);
  const [users, active, attemptsWeek, writing, speaking, writingWeek, speakingWeek] = await Promise.all([
    db.user.count(),
    db.studyLog.groupBy({ by: ["userId"], where: { day: { gte: startOfUtcDay(weekAgo) } } }),
    db.attempt.count({ where: { status: "submitted", submittedAt: { gte: weekAgo } } }),
    db.writingSubmission.count(),
    db.speakingSubmission.count(),
    db.writingSubmission.count({ where: { createdAt: { gte: weekAgo } } }),
    db.speakingSubmission.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);
  return {
    users,
    activeLearners: active.length,
    attemptsWeek,
    submissions: writing + speaking,
    submissionsWeek: writingWeek + speakingWeek,
  };
}

/** Study minutes per calendar day over the heatmap window (also feeds the recap and today's goal). */
export const getDailyMinutes = cache(async (userId: string, today: Date = calendarToday()): Promise<StudyEntry[]> => {
  const since = addDays(startOfUtcWeek(today), -7 * (HEATMAP_WEEKS - 1));
  const rows = await db.studyLog.groupBy({ by: ["day"], where: { userId, day: { gte: since } }, _sum: { minutes: true } });
  return rows.map((r) => ({ day: r.day, minutes: r._sum.minutes ?? 0 }));
});

/** The real instant a calendar-day label starts at in the app's time zone. */
const dayStartInstant = (label: Date): Date => zonedTime(isoDay(label), 0, 0, APP_TIMEZONE);

async function weekAnswers(userId: string, weekStart: Date): Promise<{ correct: number; answered: number }> {
  const rows = await db.questionResult.groupBy({
    by: ["correct"],
    where: { userId, createdAt: { gte: dayStartInstant(weekStart), lt: dayStartInstant(addDays(weekStart, 7)) } },
    _count: { _all: true },
  });
  const correct = rows.find((r) => r.correct)?._count._all ?? 0;
  return { correct, answered: rows.reduce((n, r) => n + r._count._all, 0) };
}

/** Recap of the week starting `weekStart` (a Monday label) against the week before. */
export async function getWeeklyRecap(userId: string, weekStart: Date, study: readonly StudyEntry[]): Promise<WeeklyRecap> {
  const start = startOfUtcWeek(weekStart);
  const prev = addDays(start, -7);
  const [attempts, now, before, bandPoints] = await Promise.all([
    db.attempt.findMany({
      where: {
        userId,
        status: "submitted",
        mode: { in: ["practice", "drill", "mock"] },
        submittedAt: { gte: dayStartInstant(prev), lt: dayStartInstant(addDays(start, 7)) },
      },
      select: { submittedAt: true },
    }),
    weekAnswers(userId, start),
    weekAnswers(userId, prev),
    getBandPoints(userId),
  ]);
  return weeklyRecap({
    weekStart: start,
    study,
    // Compare as calendar labels, like StudyLog days, so a late-evening set lands on the right week.
    submittedAt: attempts.flatMap((a) => (a.submittedAt ? [calendarToday(a.submittedAt)] : [])),
    answers: new Map([
      [isoDay(start), now],
      [isoDay(prev), before],
    ]),
    bandPoints,
  });
}

export interface NextStepFacts {
  openAttempt: { id: string; mode: AttemptMode; title: string | null } | null;
  openMistakes: number;
  lastMockAt: Date | null;
  submittedSets: number;
  nextLesson: { id: string; title: string; skill: string | null } | null;
  /** Most-answered skill per question category, for colouring focus areas. */
  categorySkills: Map<string, string>;
}

/** An in-progress attempt untouched for longer than this is not worth resuming. */
const RESUME_DAYS = 14;

/** The facts `recommendNext` needs beyond the stats the dashboard already loads. */
export async function getNextStepFacts(userId: string, modules: string[], now: Date = new Date()): Promise<NextStepFacts> {
  const [open, openMistakes, lastMock, submittedSets, done, categorySkills] = await Promise.all([
    db.attempt.findFirst({
      where: { userId, status: "in_progress", updatedAt: { gte: addDays(now, -RESUME_DAYS) } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, mode: true, contentId: true },
    }),
    db.mistakeItem.count({ where: { userId, mastered: false } }),
    db.attempt.findFirst({ where: { userId, mode: "mock", status: "submitted" }, orderBy: { submittedAt: "desc" }, select: { submittedAt: true } }),
    db.attempt.count({ where: { userId, status: "submitted", mode: { in: ["practice", "mock"] } } }),
    db.lessonProgress.findMany({ where: { userId }, select: { lessonId: true } }),
    db.questionResult.groupBy({ by: ["category", "skill"], where: { userId }, _count: { _all: true } }),
  ]);
  const [nextLesson, titles] = await Promise.all([
    db.contentItem.findFirst({
      // Lessons are usually module-neutral (no module), so only a module set for the other exam excludes one.
      where: {
        kind: "lesson",
        published: true,
        unlisted: false,
        OR: [{ module: null }, { module: { in: modules } }],
        id: { notIn: done.map((d) => d.lessonId) },
      },
      orderBy: [{ sortOrder: "asc" }, { difficulty: "asc" }, { title: "asc" }],
      select: { id: true, title: true, skill: true },
    }),
    open && open.contentId !== PLACEMENT_ID ? titlesFor([open.contentId]) : Promise.resolve(new Map<string, string>()),
  ]);
  const bestSkill = [...categorySkills]
    .sort((a, b) => b._count._all - a._count._all)
    .reduce((acc, r) => (acc.has(r.category) ? acc : new Map(acc).set(r.category, r.skill)), new Map<string, string>());
  return {
    openAttempt: open ? { id: open.id, mode: open.mode, title: titles.get(open.contentId) ?? null } : null,
    openMistakes,
    lastMockAt: lastMock?.submittedAt ?? null,
    submittedSets,
    nextLesson,
    categorySkills: bestSkill,
  };
}
