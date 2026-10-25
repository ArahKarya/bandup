import { describe, expect, it } from "vitest";
import { recommendNext, weakestSkill, type RecommendInput } from "@/lib/plan/recommend";
import {
  RULES,
  RULE_KEYS,
  achievementViews,
  earnedKeys,
  emptySnapshot,
  newlyEarned,
  type AchievementSnapshot,
} from "@/lib/achievements/rules";
import { dictionaries } from "@/lib/i18n/dictionaries";
import type { PlanActivity } from "@/lib/plan/study-plan";

const base: RecommendInput = {
  openAttempt: null,
  vocabDue: 0,
  todayPlan: [],
  goalMet: false,
  openMistakes: 0,
  weakCategory: null,
  weakCategorySkill: null,
  daysSinceMock: null,
  submittedSets: 0,
  nextLesson: null,
  bands: {},
};

const practice: PlanActivity = { kind: "practice", skill: "reading", minutes: 27, label: "Reading practice" };
const vocab: PlanActivity = { kind: "vocab", minutes: 10, label: "Vocabulary review" };

describe("recommendNext", () => {
  it("resumes an open attempt before anything else", () => {
    const step = recommendNext({ ...base, openAttempt: { id: "a1", mode: "practice", title: "Set 1" }, vocabDue: 50, openMistakes: 20 });
    expect(step).toMatchObject({ kind: "resume", href: "/attempt/a1", title: "Set 1" });
  });

  it("asks for vocabulary review once ten or more words are due", () => {
    expect(recommendNext({ ...base, vocabDue: 12, todayPlan: [practice] })).toMatchObject({ kind: "vocab", href: "/vocab/review", count: 12 });
    expect(recommendNext({ ...base, vocabDue: 9, todayPlan: [practice] }).kind).toBe("plan");
  });

  it("starts today's main (non-vocab) plan activity while the goal is open", () => {
    const step = recommendNext({ ...base, todayPlan: [vocab, practice] });
    expect(step).toMatchObject({ kind: "plan", href: "/practice?skill=reading", minutes: 27, skill: "reading" });
    expect(recommendNext({ ...base, todayPlan: [vocab] })).toMatchObject({ kind: "plan", href: "/vocab/review" });
    const drill: PlanActivity = { kind: "practice", skill: "reading", category: "matching_headings", minutes: 20, label: "Drill" };
    expect(recommendNext({ ...base, todayPlan: [drill] }).href).toBe("/practice?category=matching_headings");
    expect(recommendNext({ ...base, todayPlan: [{ kind: "mock", minutes: 165, label: "Mock" }] }).href).toBe("/mock");
    expect(recommendNext({ ...base, todayPlan: [{ kind: "lesson", skill: "writing", minutes: 10, label: "L" }] }).href).toBe("/learn");
  });

  it("moves past the plan once the daily goal is met", () => {
    const step = recommendNext({ ...base, todayPlan: [practice], goalMet: true, openMistakes: 6 });
    expect(step).toMatchObject({ kind: "mistakes", href: "/mistakes", count: 6 });
  });

  it("drills mistakes only from five open items, then targets the weakest category", () => {
    const weak = { ...base, openMistakes: 4, weakCategory: "true_false_not_given" as const, weakCategorySkill: "reading" as const };
    expect(recommendNext(weak)).toMatchObject({ kind: "weak", href: "/practice?category=true_false_not_given", skill: "reading" });
  });

  it("suggests a mock after 14 days without one, or for an established learner who never took one", () => {
    expect(recommendNext({ ...base, daysSinceMock: 14 }).kind).toBe("mock");
    expect(recommendNext({ ...base, daysSinceMock: 13 }).kind).toBe("practice");
    expect(recommendNext({ ...base, daysSinceMock: null, submittedSets: 3 }).kind).toBe("mock");
    expect(recommendNext({ ...base, daysSinceMock: null, submittedSets: 2 }).kind).toBe("practice");
  });

  it("falls back to a lesson, then to practising the weakest skill — never nothing", () => {
    const lesson = recommendNext({ ...base, nextLesson: { id: "l-1", title: "Skimming", skill: "reading" } });
    expect(lesson).toMatchObject({ kind: "lesson", href: "/learn/l-1", title: "Skimming", skill: "reading" });
    expect(recommendNext({ ...base, nextLesson: { id: "g", title: "Intro", skill: "general" } }).skill).toBeUndefined();
    const fallback = recommendNext({ ...base, bands: { listening: 6, reading: 6.5, writing: 5.5, speaking: 6 } });
    expect(fallback).toMatchObject({ kind: "practice", href: "/practice?skill=writing", skill: "writing" });
  });

  it("treats an unmeasured skill as the weakest", () => {
    expect(weakestSkill({ listening: 6, reading: 6, writing: 6 })).toBe("speaking");
    expect(weakestSkill({})).toBe("listening");
  });
});

const snap = (over: Partial<AchievementSnapshot>): AchievementSnapshot => ({ ...emptySnapshot(), ...over });

describe("achievement rules", () => {
  it("earns nothing on a fresh account", () => {
    expect(earnedKeys(emptySnapshot())).toEqual([]);
  });

  it("awards first steps, streaks, words, bands, drills and hours at their thresholds", () => {
    const s = snap({
      practiceSets: 1,
      mocks: 1,
      placementDone: true,
      streak: 7,
      wordsLearned: 100,
      bestBand: 6.5,
      drills: 10,
      mistakesMastered: 9,
      minutesTotal: 600,
    });
    const keys = earnedKeys(s);
    expect(keys).toEqual(
      expect.arrayContaining(["firstPractice", "firstMock", "placementDone", "streak3", "streak7", "words50", "words100", "band65", "drills10", "hours10"]),
    );
    expect(keys).not.toContain("streak30");
    expect(keys).not.toContain("words300");
    expect(keys).not.toContain("band70");
    expect(keys).not.toContain("mistakes10");
  });

  it("completes a skill's lessons only when every lesson is done, and never for a skill without lessons", () => {
    const lessons = { ...emptySnapshot().lessons, reading: { done: 7, total: 7 }, writing: { done: 6, total: 7 } };
    const keys = earnedKeys(snap({ lessons }));
    expect(keys).toContain("lessonsReading");
    expect(keys).not.toContain("lessonsWriting");
    expect(keys).not.toContain("lessonsSpeaking");
  });

  it("returns only badges not stored yet", () => {
    const s = snap({ practiceSets: 3, streak: 3 });
    expect(newlyEarned(s, ["firstPractice"])).toEqual(["streak3"]);
  });

  it("keeps earned badges earned and reports progress for locked ones", () => {
    const at = new Date("2026-01-01T00:00:00Z");
    const views = achievementViews(snap({ streak: 1 }), new Map([["streak7", at]]));
    const streak7 = views.find((v) => v.rule.key === "streak7");
    const streak3 = views.find((v) => v.rule.key === "streak3");
    expect(streak7).toMatchObject({ earnedAt: at, ratio: 1, current: 7, goal: 7 });
    expect(streak3).toMatchObject({ earnedAt: null, current: 1, goal: 3 });
    expect(streak3?.ratio).toBeCloseTo(1 / 3);
  });

  it("caps progress at the goal and reports hours in whole hours", () => {
    const hours = RULES.find((r) => r.key === "hours10");
    expect(hours?.progress(snap({ minutesTotal: 359 }))).toEqual({ current: 5, goal: 10 });
    const words = RULES.find((r) => r.key === "words50");
    expect(words?.progress(snap({ wordsLearned: 80 }))).toEqual({ current: 50, goal: 50 });
  });

  it("has unique keys, each with a title in both languages", () => {
    expect(new Set(RULE_KEYS).size).toBe(RULE_KEYS.length);
    for (const locale of ["en", "id"] as const) {
      const badges = dictionaries[locale].motivation.badges as Record<string, { title: string; body: string }>;
      for (const key of RULE_KEYS) expect(badges[key]?.title, `${locale}:${key}`).toBeTruthy();
    }
  });
});
