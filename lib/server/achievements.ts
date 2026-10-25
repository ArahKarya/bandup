import "server-only";

import { db } from "./db";
import { flash } from "./ui-prefs";
import { calendarToday } from "@/lib/stats/dates";
import { computeStreak } from "@/lib/stats/study-time";
import { dictionaries, isLocale } from "@/lib/i18n/dictionaries";
import {
  LESSON_SKILLS,
  WORD_REPS_LEARNED,
  achievementViews,
  newlyEarned,
  type AchievementSnapshot,
  type AchievementView,
  type LessonSkill,
} from "@/lib/achievements/rules";

/**
 * Builds the achievement snapshot and stores newly earned badges. Called after each
 * activity (submitting a set, reviewing a word, finishing a lesson, scoring a task); it
 * must never break that activity, so every failure is contained here.
 */

const STREAK_LOOKBACK_DAYS = 400;

const isLessonSkill = (s: string | null): s is LessonSkill => s !== null && (LESSON_SKILLS as readonly string[]).includes(s);

export async function buildSnapshot(userId: string, today: Date = calendarToday()): Promise<AchievementSnapshot> {
  const [modes, days, minutes, wordsLearned, lessons, done, best, mistakesMastered, profile] = await Promise.all([
    db.attempt.groupBy({ by: ["mode"], where: { userId, status: "submitted" }, _count: { _all: true } }),
    db.studyLog.findMany({ where: { userId, minutes: { gt: 0 } }, distinct: ["day"], orderBy: { day: "desc" }, take: STREAK_LOOKBACK_DAYS, select: { day: true } }),
    db.studyLog.aggregate({ where: { userId }, _sum: { minutes: true } }),
    db.vocabReview.count({ where: { userId, reps: { gte: WORD_REPS_LEARNED } } }),
    db.contentItem.findMany({ where: { kind: "lesson", published: true, unlisted: false }, select: { id: true, skill: true } }),
    db.lessonProgress.findMany({ where: { userId }, select: { lessonId: true } }),
    db.skillScore.aggregate({ where: { userId, skill: { not: "grammar" } }, _max: { band: true } }),
    db.mistakeItem.count({ where: { userId, mastered: true } }),
    db.profile.findUnique({ where: { userId }, select: { startingBand: true } }),
  ]);

  const byMode = new Map(modes.map((m) => [m.mode, m._count._all]));
  const doneIds = new Set(done.map((d) => d.lessonId));
  const lessonCounts = Object.fromEntries(
    LESSON_SKILLS.map((skill) => {
      const ofSkill = lessons.filter((l) => isLessonSkill(l.skill) && l.skill === skill);
      return [skill, { done: ofSkill.filter((l) => doneIds.has(l.id)).length, total: ofSkill.length }];
    }),
  ) as AchievementSnapshot["lessons"];

  return {
    practiceSets: byMode.get("practice") ?? 0,
    mocks: byMode.get("mock") ?? 0,
    drills: byMode.get("drill") ?? 0,
    placementDone: (byMode.get("placement") ?? 0) > 0 || profile?.startingBand != null,
    streak: computeStreak(days.map((d) => d.day), today),
    wordsLearned,
    lessons: lessonCounts,
    bestBand: best._max.band ?? null,
    mistakesMastered,
    minutesTotal: minutes._sum.minutes ?? 0,
  };
}

export interface AwardOptions {
  /** Queue a toast per new badge. Off when rendering a page, where cookies are read-only. */
  notify?: boolean;
}

/** Stores badges the learner now qualifies for; returns the keys that were new. */
export async function awardAchievements(userId: string, { notify = true }: AwardOptions = {}): Promise<string[]> {
  try {
    const [snapshot, existing] = await Promise.all([
      buildSnapshot(userId),
      db.achievement.findMany({ where: { userId }, select: { key: true } }),
    ]);
    const fresh = newlyEarned(snapshot, existing.map((e) => e.key));
    if (fresh.length === 0) return [];

    // skipDuplicates + returning: two racing calls can both see a key as new, but only one inserts it.
    const inserted = await db.achievement.createManyAndReturn({
      data: fresh.map((key) => ({ userId, key })),
      skipDuplicates: true,
      select: { key: true },
    });
    const keys = inserted.map((r) => r.key);
    if (notify && keys.length > 0) await announce(userId, keys);
    return keys;
  } catch (error: unknown) {
    console.error("awardAchievements failed", { userId, error });
    return [];
  }
}

async function announce(userId: string, keys: readonly string[]): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { locale: true } });
  const t = dictionaries[isLocale(user?.locale) ? user.locale : "id"];
  const shown: string[] = [];
  for (const key of keys) {
    const text = t.motivation.badges[key as keyof typeof t.motivation.badges];
    try {
      await flash({ tone: "achievement", title: `${t.motivation.unlocked}: ${text?.title ?? key}`, body: text?.body });
      shown.push(key);
    } catch {
      // Outside a server action or route handler cookies are read-only; the badge stays
      // unseen and the achievements page highlights it instead.
      break;
    }
  }
  if (shown.length > 0) await db.achievement.updateMany({ where: { userId, key: { in: shown } }, data: { seen: true } });
}

/** Earned badges with their dates, for the achievements page and previews. */
export async function getEarned(userId: string): Promise<{ key: string; earnedAt: Date; seen: boolean }[]> {
  return db.achievement.findMany({ where: { userId }, orderBy: { earnedAt: "desc" }, select: { key: true, earnedAt: true, seen: true } });
}

export async function markSeen(userId: string): Promise<void> {
  await db.achievement.updateMany({ where: { userId, seen: false }, data: { seen: true } });
}

/** Every badge with its state, plus the keys not yet acknowledged (shown as "new"). */
export async function getAchievementViews(userId: string): Promise<{ views: AchievementView[]; unseen: Set<string> }> {
  const [snapshot, earned] = await Promise.all([buildSnapshot(userId), getEarned(userId)]);
  return {
    views: achievementViews(snapshot, new Map(earned.map((e) => [e.key, e.earnedAt]))),
    unseen: new Set(earned.filter((e) => !e.seen).map((e) => e.key)),
  };
}
