import { describe, expect, it } from "vitest";
import { isMature, newCard, review } from "@/lib/srs/sm2";
import { decryptSecret, deriveKey, encryptSecret, maskSecret } from "@/lib/crypto/secret";
import { buildStudyPlan, humanCategory, skillGaps, skillRotation, weakCategories } from "@/lib/plan/study-plan";
import { checkGroup, checkMock, checkSet, countWords } from "@/lib/content/check";
import type { MockTest, QuestionSet } from "@/lib/content/schema";

const NOW = new Date("2026-01-05T08:00:00Z"); // a Monday
const DAY = 86_400_000;

describe("SM-2", () => {
  it("schedules a new card one day out on 'good' and six days on the second success", () => {
    const first = review(newCard(NOW), "good", NOW);
    expect(first.interval).toBe(1);
    const second = review(first, "good", first.due);
    expect(second.interval).toBe(6);
    expect(second.due.getTime() - first.due.getTime()).toBe(6 * DAY);
  });

  it("grows intervals by ease after the second review", () => {
    let card = newCard(NOW);
    for (let i = 0; i < 4; i++) card = review(card, "good", card.due);
    expect(card.interval).toBeGreaterThan(20);
    expect(isMature(card)).toBe(true);
  });

  it("resets on 'again' and lowers ease but never below 1.3", () => {
    let card = review(newCard(NOW), "good", NOW);
    for (let i = 0; i < 10; i++) card = review(card, "again", NOW);
    expect(card.reps).toBe(0);
    expect(card.lapses).toBe(10);
    expect(card.ease).toBe(1.3);
    expect(card.due.getTime() - NOW.getTime()).toBeLessThan(DAY);
  });

  it("gives easy cards a longer first interval and hard cards a shorter later one", () => {
    expect(review(newCard(NOW), "easy", NOW).interval).toBe(4);
    const base = { ease: 2.5, interval: 10, reps: 3, lapses: 0, due: NOW };
    expect(review(base, "hard", NOW).interval).toBeLessThan(review(base, "good", NOW).interval);
    expect(review(base, "easy", NOW).interval).toBeGreaterThan(review(base, "good", NOW).interval);
  });
});

describe("secret encryption", () => {
  const secret = "test-encryption-secret";

  it("round-trips and produces a different ciphertext each time", () => {
    const a = encryptSecret("sk-ant-12345", secret);
    const b = encryptSecret("sk-ant-12345", secret);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, secret)).toBe("sk-ant-12345");
  });

  it("fails with the wrong key or a tampered payload", () => {
    const stored = encryptSecret("sk-ant-12345", secret);
    expect(() => decryptSecret(stored, "other")).toThrow();
    const parts = stored.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join("."), secret)).toThrow();
    expect(() => decryptSecret("garbage", secret)).toThrow(/format/);
  });

  it("uses a raw 32-byte base64 key as-is", () => {
    const raw = Buffer.alloc(32, 7).toString("base64");
    expect(deriveKey(raw)).toEqual(Buffer.alloc(32, 7));
    expect(deriveKey("short").length).toBe(32);
  });

  it("masks all but the last four characters", () => {
    expect(maskSecret("sk-ant-abcdWXYZ")).toBe("••••WXYZ");
    expect(maskSecret("abc")).toBe("••••");
  });
});

describe("study plan", () => {
  it("measures the gap to target per skill, defaulting unknown skills to one band", () => {
    expect(skillGaps({ targetBand: 7, bands: { reading: 6, listening: 7.5 } })).toEqual({
      listening: 0,
      reading: 1,
      writing: 1,
      speaking: 1,
    });
  });

  it("schedules the weakest skill most often", () => {
    const rotation = skillRotation({ listening: 0, reading: 2, writing: 0, speaking: 0 }, 20);
    const counts = rotation.reduce<Record<string, number>>((m, s) => ({ ...m, [s]: (m[s] ?? 0) + 1 }), {});
    expect(counts.reading).toBeGreaterThan(counts.listening);
  });

  it("picks weak categories below 75 %, weakest first", () => {
    expect(
      weakCategories({ matching_headings: 0.4, true_false_not_given: 0.6, multiple_choice: 0.9, grammar: 0.1 }),
    ).toEqual(["matching_headings", "true_false_not_given"]);
  });

  it("spans the weeks until the exam and ends with mock tests", () => {
    const plan = buildStudyPlan({
      today: NOW,
      examDate: new Date(NOW.getTime() + 28 * DAY),
      targetBand: 7,
      dailyMinutes: 60,
      bands: { reading: 6 },
      categoryAccuracy: { matching_headings: 0.3 },
    });
    expect(plan.weeksUntilExam).toBe(4);
    expect(plan.weeks).toHaveLength(4);
    expect(plan.weeks[0].focus).toMatch(/Foundations/);
    const last = plan.weeks[3].days.at(-1);
    expect(last?.activities[0].kind).toBe("mock");
    const drills = plan.weeks.flatMap((w) => w.days.flatMap((d) => d.activities)).filter((a) => a.category);
    expect(drills[0].category).toBe("matching_headings");
    expect(plan.weeks.flatMap((w) => w.days).every((d) => d.date < "2026-02-02")).toBe(true);
  });

  it("defaults to eight weeks without an exam date and respects chosen study days", () => {
    const plan = buildStudyPlan({
      today: NOW,
      examDate: null,
      targetBand: 6.5,
      dailyMinutes: 10,
      bands: {},
      categoryAccuracy: {},
      studyDays: [1, 3],
    });
    expect(plan.weeksUntilExam).toBeNull();
    expect(plan.weeks).toHaveLength(8);
    expect(plan.weeks[1].days).toHaveLength(2);
    expect(plan.weeks[1].days[0].activities.find((a) => a.kind === "practice")?.minutes).toBe(12);
  });

  it("labels categories for people", () => {
    expect(humanCategory("true_false_not_given")).toBe("True / False / Not Given");
    expect(humanCategory("matching_headings")).toBe("Matching headings");
  });
});

const tfngSet = (overrides: Partial<QuestionSet> = {}): QuestionSet => ({
  id: "s",
  kind: "question_set",
  skill: "reading",
  module: "academic",
  title: "s",
  difficulty: 1,
  minutes: 1,
  tags: [],
  unlisted: true,
  passage: { title: "p", paragraphs: [{ text: "x" }] },
  groups: [
    {
      type: "tfng",
      variant: "tfng",
      category: "true_false_not_given",
      instructions: "i",
      questions: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, statement: "s", answer: "TRUE" as const })),
    },
  ],
  ...overrides,
});

describe("content checks", () => {
  it("counts words", () => {
    expect(countWords("  two  words ")).toBe(2);
  });

  it("flags answer keys that do not exist", () => {
    expect(
      checkGroup({
        type: "mcq_single",
        category: "multiple_choice",
        instructions: "i",
        questions: [{ n: 1, prompt: "p", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }], answer: "D" }],
      }),
    ).toHaveLength(1);
    expect(
      checkGroup({
        type: "matching",
        category: "matching_headings",
        instructions: "i",
        allowReuse: false,
        options: [{ key: "i", text: "a" }, { key: "ii", text: "b" }],
        questions: [
          { n: 1, prompt: "A", answer: "i" },
          { n: 2, prompt: "B", answer: "i" },
          { n: 3, prompt: "C", answer: "x" },
        ],
      }),
    ).toHaveLength(2);
  });

  it("flags YES on a TFNG group, missing blanks, long answers and bad multi keys", () => {
    expect(
      checkGroup({
        type: "tfng",
        variant: "tfng",
        category: "true_false_not_given",
        instructions: "i",
        questions: [{ n: 1, statement: "s", answer: "YES" }],
      }),
    ).toHaveLength(1);
    expect(
      checkGroup({
        type: "completion",
        category: "note_completion",
        instructions: "i",
        maxWords: 1,
        allowNumber: true,
        template: "{{1}}",
        questions: [
          { n: 1, answers: ["two words"] },
          { n: 2, answers: ["x"] },
        ],
      }),
    ).toHaveLength(2);
    expect(
      checkGroup({
        type: "completion",
        category: "summary_completion",
        instructions: "i",
        maxWords: 1,
        allowNumber: false,
        wordBank: [{ key: "A", text: "a" }],
        questions: [{ n: 1, prompt: "{{1}}", answers: ["B"] }],
      }),
    ).toHaveLength(1);
    expect(
      checkGroup({
        type: "mcq_multi",
        category: "multiple_choice",
        instructions: "i",
        questions: [
          {
            numbers: [1, 2],
            prompt: "p",
            options: ["A", "B", "C", "D"].map((key) => ({ key, text: key })),
            answers: ["A", "E", "B"],
          },
        ],
      }),
    ).toHaveLength(2);
  });

  it("flags non-consecutive numbering", () => {
    const set = tfngSet();
    const group = set.groups[0];
    if (group.type !== "tfng") throw new Error("unreachable");
    expect(checkSet({ ...set, groups: [{ ...group, questions: [group.questions[0], { ...group.questions[1], n: 5 }] }] })).toHaveLength(1);
  });

  it("validates a mock test's structure", () => {
    const listening = (id: string, part: number, start: number): QuestionSet => {
      const set = tfngSet({ id, skill: "listening", module: "both", part });
      const group = set.groups[0];
      if (group.type !== "tfng") throw new Error("unreachable");
      return { ...set, groups: [{ ...group, questions: group.questions.map((q, i) => ({ ...q, n: start + i })) }] };
    };
    const sets = new Map<string, QuestionSet>(
      [listening("l1", 1, 1), listening("l2", 2, 11), listening("l3", 3, 21), listening("l4", 4, 31)].map((s) => [s.id, s]),
    );
    sets.set("r1", tfngSet({ id: "r1", module: "general" }));
    const mock: MockTest = {
      id: "m",
      kind: "mock_test",
      module: "academic",
      title: "m",
      description: "",
      listening: ["l1", "l2", "l3", "l4"],
      reading: ["r1", "missing", "l1"],
      writing: ["w2", "w1"],
      speaking: ["s1", "s2", "nope"],
    };
    const issues = checkMock(mock, {
      sets,
      writing: new Map([
        ["w1", { task: 1 as const, module: "academic" }],
        ["w2", { task: 2 as const, module: "both" }],
      ]),
      speaking: new Map([
        ["s1", { part: 1 as const }],
        ["s2", { part: 2 as const }],
      ]),
    });
    expect(issues.filter((i) => i.startsWith("listening"))).toHaveLength(0);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"missing" does not exist'),
        expect.stringContaining('"l1" is listening'),
        expect.stringContaining("is for general"),
        expect.stringContaining("Task 2, placed as Task 1"),
        expect.stringContaining('"nope" does not exist'),
      ]),
    );
  });
});

import { calendarToday } from "@/lib/stats/dates";

describe("calendarToday", () => {
  it("uses the configured zone's date, not the UTC date", () => {
    // 20:00 UTC on 24 Oct is already 25 Oct in Jakarta (UTC+7).
    const now = new Date("2026-10-24T20:00:00Z");
    expect(calendarToday(now, "Asia/Jakarta").toISOString()).toBe("2026-10-25T00:00:00.000Z");
    expect(calendarToday(now, "UTC").toISOString()).toBe("2026-10-24T00:00:00.000Z");
    expect(calendarToday(now, "America/New_York").toISOString()).toBe("2026-10-24T00:00:00.000Z");
  });
});
