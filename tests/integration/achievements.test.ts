import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// React's per-request cache is not available outside a render; a pass-through is equivalent here.
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const { db } = await import("@/lib/server/db");
const { advanceAttempt, openAttempt } = await import("@/lib/server/attempts");
const { awardAchievements, buildSnapshot, getAchievementViews } = await import("@/lib/server/achievements");
const { getDailyMinutes, getNextStepFacts, getWeeklyRecap } = await import("@/lib/server/stats");
const { addDays, calendarToday, startOfUtcWeek } = await import("@/lib/stats/dates");

/**
 * Achievements against the real database (DATABASE_URL). Outside a request `flash()` cannot
 * set cookies, which also exercises the "never break the activity" path: badges are stored
 * and stay unseen. Requires `pnpm content:sync`.
 */
describe("achievements", () => {
  let userId = "";

  beforeAll(async () => {
    const user = await db.user.create({
      data: { email: `it-ach-${Date.now()}@example.com`, name: "IT", passwordHash: "x", profile: { create: { onboardedAt: new Date() } } },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("earns nothing on a fresh account", async () => {
    expect(await awardAchievements(userId)).toEqual([]);
    const snapshot = await buildSnapshot(userId);
    expect(snapshot).toMatchObject({ practiceSets: 0, streak: 0, wordsLearned: 0, bestBand: null });
    expect(snapshot.lessons.reading.total).toBeGreaterThan(0);
  });

  it("awards first practice once a set is submitted, exactly once", async () => {
    const attempt = await openAttempt(userId, "practice", "prd-living-light");
    await advanceAttempt(attempt.id, 0, { answers: {} });

    const first = await awardAchievements(userId);
    expect(first).toContain("firstPractice");
    expect(await awardAchievements(userId)).toEqual([]);

    const rows = await db.achievement.findMany({ where: { userId, key: "firstPractice" } });
    expect(rows).toHaveLength(1);
    // No request context, so no toast could be queued: the badge waits as unseen.
    expect(rows[0].seen).toBe(false);
  });

  it("stores a badge once when several activities finish at the same time", async () => {
    const today = calendarToday();
    await db.studyLog.createMany({
      data: [0, 1, 2].map((i) => ({ userId, day: addDays(today, -i), activity: "reading", minutes: 30 })),
      skipDuplicates: true,
    });
    const results = await Promise.all([0, 1, 2, 3].map(() => awardAchievements(userId)));
    expect(results.flat().filter((k) => k === "streak3")).toHaveLength(1);
    expect(await db.achievement.count({ where: { userId, key: "streak3" } })).toBe(1);
  });

  it("counts words recalled twice in a row as learned", async () => {
    const due = new Date();
    await db.vocabReview.createMany({
      data: [
        { userId, wordId: "it-w1", deckId: "it-deck", reps: 2, due },
        { userId, wordId: "it-w2", deckId: "it-deck", reps: 1, due },
      ],
    });
    expect((await buildSnapshot(userId)).wordsLearned).toBe(1);
  });

  it("lists every badge with earned state and unseen keys", async () => {
    const { views, unseen } = await getAchievementViews(userId);
    expect(views.find((v) => v.rule.key === "firstPractice")?.earnedAt).toBeInstanceOf(Date);
    expect(views.find((v) => v.rule.key === "streak7")).toMatchObject({ earnedAt: null, goal: 7 });
    expect(unseen.has("firstPractice")).toBe(true);
  });

  it("feeds the dashboard: next-step facts and the weekly recap", async () => {
    const facts = await getNextStepFacts(userId, ["academic", "both"]);
    expect(facts.openAttempt).toBeNull();
    expect(facts.submittedSets).toBe(1);
    expect(facts.nextLesson).not.toBeNull();

    const today = calendarToday();
    const daily = await getDailyMinutes(userId, today);
    const recap = await getWeeklyRecap(userId, startOfUtcWeek(today), daily);
    expect(recap.minutes).toBeGreaterThan(0);
    expect(recap.sets).toBe(1);
  });
});
