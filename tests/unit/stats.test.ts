import { describe, expect, it } from "vitest";
import { addDays, daysUntil, formatDay, isoDay, startOfUtcDay, startOfUtcWeek } from "@/lib/stats/dates";
import { computeStreak, minutesThisWeek, weeklyMinutes } from "@/lib/stats/study-time";
import { bandTimeline, estimatedOverall, latestBands, roundHalf } from "@/lib/stats/bands";
import { accuracyTone, categoryStats, weakestCategories } from "@/lib/stats/accuracy";
import { activityHref, activityLabel, phaseOf, planDayFor } from "@/lib/stats/plan-view";
import { checkRoleChange } from "@/lib/stats/role-rules";
import { buildStudyPlan, type PlanActivity } from "@/lib/plan/study-plan";

const TODAY = new Date("2026-01-07T15:30:00Z"); // a Wednesday
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe("UTC dates", () => {
  it("truncates to the UTC day and finds Monday of the week", () => {
    expect(isoDay(startOfUtcDay(TODAY))).toBe("2026-01-07");
    expect(isoDay(startOfUtcWeek(TODAY))).toBe("2026-01-05");
    // Sunday belongs to the week that started the previous Monday.
    expect(isoDay(startOfUtcWeek(day("2026-01-11")))).toBe("2026-01-05");
    expect(isoDay(addDays(TODAY, -7))).toBe("2025-12-31");
  });

  it("formats days in the UI language without shifting them", () => {
    expect(formatDay("2026-01-07", "en")).toBe("7 Jan 2026");
    expect(formatDay(day("2026-01-07"), "id", false)).toMatch(/^7 Jan/);
  });

  it("counts days to the exam", () => {
    expect(daysUntil(day("2026-01-17"), TODAY)).toBe(10);
    expect(daysUntil(day("2026-01-07"), TODAY)).toBe(0);
    expect(daysUntil(day("2026-01-01"), TODAY)).toBe(-6);
  });
});

describe("streak", () => {
  it("counts consecutive days ending today", () => {
    expect(computeStreak([day("2026-01-07"), day("2026-01-06"), day("2026-01-05"), day("2026-01-03")], TODAY)).toBe(3);
  });

  it("does not break while today is still empty", () => {
    expect(computeStreak([day("2026-01-06"), day("2026-01-05")], TODAY)).toBe(2);
  });

  it("is zero after a missed day, and ignores duplicates", () => {
    expect(computeStreak([day("2026-01-05")], TODAY)).toBe(0);
    expect(computeStreak([], TODAY)).toBe(0);
    expect(computeStreak([day("2026-01-07"), day("2026-01-07")], TODAY)).toBe(1);
  });
});

describe("study time", () => {
  const entries = [
    { day: day("2026-01-07"), minutes: 20 },
    { day: day("2026-01-05"), minutes: 30 },
    { day: day("2026-01-04"), minutes: 45 }, // previous week (Sunday)
    { day: day("2025-11-01"), minutes: 99 }, // outside 8 weeks
  ];

  it("sums this week from Monday", () => {
    expect(minutesThisWeek(entries, TODAY)).toBe(50);
  });

  it("buckets the last eight weeks oldest first, including empty weeks", () => {
    const weeks = weeklyMinutes(entries, TODAY);
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toEqual({ weekStart: "2026-01-05", minutes: 50 });
    expect(weeks[6]).toEqual({ weekStart: "2025-12-29", minutes: 45 });
    expect(weeks[0].weekStart).toBe("2025-11-17");
    expect(weeks.reduce((s, w) => s + w.minutes, 0)).toBe(95);
  });
});

describe("bands", () => {
  const points = [
    { skill: "reading", band: 6, createdAt: day("2026-01-01") },
    { skill: "reading", band: 7, createdAt: day("2026-01-03") },
    { skill: "reading", band: 6.5, createdAt: day("2026-01-05") },
    { skill: "reading", band: 5, createdAt: day("2025-12-01") },
    { skill: "listening", band: 7, createdAt: day("2026-01-02") },
    { skill: "grammar", band: 4, createdAt: day("2026-01-02") },
  ];

  it("takes the latest score per skill, or the mean of the last N", () => {
    expect(latestBands(points)).toEqual({ reading: 6.5, listening: 7 });
    expect(latestBands(points, 3)).toEqual({ reading: 6.5, listening: 7 });
    expect(latestBands(points, 4).reading).toBe(6);
    expect(latestBands([], 3)).toEqual({});
  });

  it("rounds to the nearest half band", () => {
    expect(roundHalf(6.24)).toBe(6);
    expect(roundHalf(6.26)).toBe(6.5);
  });

  it("needs all four skills for an overall estimate", () => {
    expect(estimatedOverall({ reading: 6, listening: 7 })).toBeNull();
    expect(estimatedOverall({ reading: 6, listening: 6.5, writing: 6, speaking: 6 })).toBe(6);
    expect(estimatedOverall({ reading: 6.5, listening: 6.5, writing: 6, speaking: 6 })).toBe(6.5);
  });

  it("builds one timeline row per day, averaging same-day scores and skipping grammar", () => {
    const rows = bandTimeline([...points, { skill: "listening", band: 6, createdAt: new Date("2026-01-02T18:00:00Z") }]);
    expect(rows.map((r) => r.date)).toEqual(["2025-12-01", "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05"]);
    expect(rows[2]).toEqual({ date: "2026-01-02", listening: 6.5 });
  });
});

describe("category accuracy", () => {
  const outcomes = [
    ...Array.from({ length: 4 }, (_, i) => ({ category: "map_labelling", correct: i === 0 })),
    ...Array.from({ length: 3 }, () => ({ category: "true_false_not_given", correct: true })),
    ...Array.from({ length: 6 }, (_, i) => ({ category: "matching_headings", correct: i < 3 })),
    { category: "short_answer", correct: false },
    { category: "not_a_category", correct: false },
  ];

  it("ignores categories with fewer than three answers and unknown ones", () => {
    const stats = categoryStats(outcomes);
    expect(stats.accuracy).toEqual({ map_labelling: 0.25, true_false_not_given: 1, matching_headings: 0.5 });
    expect(stats.counts.matching_headings).toEqual({ correct: 3, total: 6 });
    expect(stats.accuracy.short_answer).toBeUndefined();
  });

  it("lists the weakest first", () => {
    expect(weakestCategories(categoryStats(outcomes))).toEqual(["map_labelling", "matching_headings", "true_false_not_given"]);
    expect(weakestCategories(categoryStats(outcomes), 1)).toEqual(["map_labelling"]);
  });

  it("breaks ties by answer count", () => {
    const tied = categoryStats([
      ...Array.from({ length: 3 }, () => ({ category: "note_completion", correct: false })),
      ...Array.from({ length: 5 }, () => ({ category: "form_completion", correct: false })),
    ]);
    expect(weakestCategories(tied)).toEqual(["form_completion", "note_completion"]);
  });

  it("colours by threshold", () => {
    expect(accuracyTone(0.75)).toBe("success");
    expect(accuracyTone(0.5)).toBe("warning");
    expect(accuracyTone(0.49)).toBe("danger");
  });
});

describe("plan view", () => {
  const labels = {
    lesson: "{skill} lesson",
    practice: "{skill} practice",
    drill: "Drill: {category}",
    vocab: "Vocab",
    mock: "Mock",
    review: "Review",
  };
  const name = (s: string) => s.toUpperCase();

  it("links each activity to the right page", () => {
    const cases: [PlanActivity, string][] = [
      [{ kind: "lesson", skill: "reading", minutes: 10, label: "" }, "/learn"],
      [{ kind: "vocab", minutes: 10, label: "" }, "/vocab/review"],
      [{ kind: "mock", minutes: 165, label: "" }, "/mock"],
      [{ kind: "practice", skill: "reading", category: "matching_headings", minutes: 20, label: "" }, "/practice?category=matching_headings"],
      [{ kind: "practice", skill: "writing", minutes: 20, label: "" }, "/practice?skill=writing"],
      [{ kind: "review", minutes: 20, label: "" }, "/practice"],
    ];
    for (const [a, href] of cases) expect(activityHref(a)).toBe(href);
  });

  it("localises labels", () => {
    expect(activityLabel({ kind: "practice", skill: "reading", category: "map_labelling", minutes: 1, label: "" }, labels, name)).toBe("Drill: Map labelling");
    expect(activityLabel({ kind: "practice", skill: "writing", minutes: 1, label: "" }, labels, name)).toBe("WRITING practice");
    expect(activityLabel({ kind: "lesson", skill: "speaking", minutes: 1, label: "" }, labels, name)).toBe("SPEAKING lesson");
    expect(activityLabel({ kind: "vocab", minutes: 1, label: "" }, labels, name)).toBe("Vocab");
  });

  it("recovers the phase from every generated week focus", () => {
    const plan = buildStudyPlan({ today: TODAY, examDate: day("2026-03-04"), targetBand: 7, dailyMinutes: 45, bands: {}, categoryAccuracy: {} });
    const phases = plan.weeks.map((w) => phaseOf(w.focus));
    expect(phases).not.toContain(null);
    expect(phases[0]).toBe("foundation");
    expect(phases.at(-1)).toBe("final");
    expect(phases).toContain("build");
    expect(phases).toContain("exam");
    expect(phaseOf("Something else")).toBeNull();
  });

  it("finds today's plan day", () => {
    const plan = buildStudyPlan({ today: TODAY, examDate: null, targetBand: 7, dailyMinutes: 45, bands: {}, categoryAccuracy: {} });
    expect(planDayFor(plan, "2026-01-07")?.activities.length).toBeGreaterThan(0);
    expect(planDayFor(plan, "2026-01-11")).toBeNull(); // Sunday is not a default study day
  });
});

describe("role changes", () => {
  const base = { actorId: "a", targetId: "b", adminCount: 2 } as const;

  it("allows promoting and demoting another admin", () => {
    expect(checkRoleChange({ ...base, currentRole: "USER", nextRole: "ADMIN" })).toBe("ok");
    expect(checkRoleChange({ ...base, currentRole: "ADMIN", nextRole: "USER" })).toBe("ok");
  });

  it("refuses self-demotion, the last admin, and no-ops", () => {
    expect(checkRoleChange({ ...base, targetId: "a", currentRole: "ADMIN", nextRole: "USER" })).toBe("self");
    expect(checkRoleChange({ ...base, adminCount: 1, currentRole: "ADMIN", nextRole: "USER" })).toBe("last_admin");
    expect(checkRoleChange({ ...base, currentRole: "USER", nextRole: "USER" })).toBe("unchanged");
  });
});
