import { describe, expect, it } from "vitest";
import { matchParagraph, parseEvidence } from "@/lib/mistakes/evidence";
import { DRILL_LIMIT, pickDrillItems, prioritise, skillsWithWrong, wrongAnswered, type DrillCandidate } from "@/lib/mistakes/drill";
import {
  answeredCount,
  groupBySet,
  hasQuestion,
  mostMissedCategory,
  parseQuestionRef,
  questionInfo,
  questionRef,
  streakDots,
} from "@/lib/mistakes/notebook";
import type { QuestionSet } from "@/lib/content/schema";
import type { AttemptResult } from "@/lib/attempt/sections";
import type { GradedItem } from "@/lib/scoring/grade";

describe("parseEvidence", () => {
  it("reads paragraph letters with or without a 'Paragraph' prefix", () => {
    expect(parseEvidence("B")).toEqual({ kind: "paragraph", label: "B" });
    expect(parseEvidence("Paragraph C")).toEqual({ kind: "paragraph", label: "C" });
    expect(parseEvidence("para. D")).toEqual({ kind: "paragraph", label: "D" });
    expect(parseEvidence("  paragraphs E ")).toEqual({ kind: "paragraph", label: "E" });
  });

  it("keeps multi-word labels and takes the first of several", () => {
    expect(parseEvidence("Text 1, Annual leave")).toEqual({ kind: "paragraph", label: "Text 1" });
    expect(parseEvidence("Notice, paragraph 4")).toEqual({ kind: "paragraph", label: "Notice" });
    expect(parseEvidence("A, F")).toEqual({ kind: "paragraph", label: "A" });
  });

  it("turns listening line numbers into 0-based indexes", () => {
    expect(parseEvidence("line 7")).toEqual({ kind: "line", index: 6 });
    expect(parseEvidence("Line 1")).toEqual({ kind: "line", index: 0 });
    expect(parseEvidence("lines 13–14")).toEqual({ kind: "line", index: 12 });
    expect(parseEvidence("lines 7, 9")).toEqual({ kind: "line", index: 6 });
    expect(parseEvidence("line 3; line 4")).toEqual({ kind: "line", index: 2 });
  });

  it("returns null for empty or impossible evidence", () => {
    expect(parseEvidence("")).toBeNull();
    expect(parseEvidence(undefined)).toBeNull();
    expect(parseEvidence(null)).toBeNull();
    expect(parseEvidence("   ")).toBeNull();
    expect(parseEvidence("line 0")).toBeNull();
    expect(parseEvidence(", x")).toBeNull();
  });
});

describe("matchParagraph", () => {
  const labels = ["A", "B", undefined, "Text 1", "Notice"];

  it("matches labels case-insensitively", () => {
    expect(matchParagraph(labels, "b")).toBe(1);
    expect(matchParagraph(labels, "text 1")).toBe(3);
    expect(matchParagraph(labels, "Notice")).toBe(4);
  });

  it("falls back to the 1-based position for bare numbers", () => {
    expect(matchParagraph(labels, "3")).toBe(2);
    expect(matchParagraph(labels, "9")).toBeNull();
    expect(matchParagraph(labels, "0")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(matchParagraph(labels, "Z")).toBeNull();
    expect(matchParagraph(labels, " ")).toBeNull();
    expect(matchParagraph([], "A")).toBeNull();
  });
});

const day = (d: number) => new Date(Date.UTC(2026, 0, d));
const cand = (over: Partial<DrillCandidate>): DrillCandidate => ({
  setId: "s1",
  n: 1,
  skill: "reading",
  timesWrong: 1,
  lastDrilledAt: null,
  createdAt: day(1),
  ...over,
});

describe("prioritise", () => {
  it("puts the most missed first", () => {
    const out = prioritise([cand({ n: 1, timesWrong: 1 }), cand({ n: 2, timesWrong: 4 }), cand({ n: 3, timesWrong: 2 })]);
    expect(out.map((i) => i.n)).toEqual([2, 3, 1]);
  });

  it("breaks ties by oldest drill (never drilled first), then oldest mistake, then position", () => {
    const out = prioritise([
      cand({ n: 1, lastDrilledAt: day(5) }),
      cand({ n: 2, lastDrilledAt: day(2) }),
      cand({ n: 3, createdAt: day(3) }),
      cand({ n: 4, createdAt: day(2) }),
      cand({ setId: "s0", n: 9, createdAt: day(2) }),
    ]);
    expect(out.map((i) => `${i.setId}:${i.n}`)).toEqual(["s0:9", "s1:4", "s1:3", "s1:2", "s1:1"]);
  });

  it("does not mutate its input", () => {
    const input = [cand({ n: 1 }), cand({ n: 2, timesWrong: 3 })];
    prioritise(input);
    expect(input.map((i) => i.n)).toEqual([1, 2]);
  });
});

describe("pickDrillItems", () => {
  it("caps at the limit and keeps only the top item's skill", () => {
    const items = [
      cand({ n: 1, skill: "listening", timesWrong: 5 }),
      cand({ n: 2, skill: "reading", timesWrong: 4 }),
      cand({ n: 3, skill: "listening", timesWrong: 1 }),
    ];
    const { picked, skipped } = pickDrillItems(items, 10);
    expect(picked.map((i) => i.n)).toEqual([1, 3]);
    expect(skipped).toBe(1);
  });

  it("uses the default limit", () => {
    const items = Array.from({ length: 30 }, (_, i) => cand({ n: i + 1 }));
    expect(pickDrillItems(items).picked).toHaveLength(DRILL_LIMIT);
    expect(pickDrillItems(items, -1).picked).toHaveLength(0);
  });

  it("handles an empty list", () => {
    expect(pickDrillItems([])).toEqual({ picked: [], skipped: 0 });
  });
});

const item = (n: number, correct: boolean, given: string): GradedItem => ({ n, category: "multiple_choice", correct, given, expected: "A" });

describe("wrongAnswered", () => {
  const result: AttemptResult = {
    sections: [
      { skill: "listening", raw: 1, max: 3, band: null, sets: [{ setId: "l1", title: "L", raw: 1, max: 3, items: [item(1, true, "A"), item(2, false, "B"), item(3, false, " ")] }] },
      { skill: "reading", raw: 0, max: 1, band: null, sets: [{ setId: "r1", title: "R", raw: 0, max: 1, items: [item(14, false, "C")] }] },
      { skill: "writing", raw: 0, max: 0, band: null, sets: [] },
    ],
  };

  it("lists answered wrong questions only, with their skill", () => {
    expect(wrongAnswered(result)).toEqual([
      { setId: "l1", n: 2, skill: "listening" },
      { setId: "r1", n: 14, skill: "reading" },
    ]);
  });

  it("filters by skill", () => {
    expect(wrongAnswered(result, "reading")).toEqual([{ setId: "r1", n: 14, skill: "reading" }]);
    expect(wrongAnswered(null)).toEqual([]);
  });

  it("names the skills that have wrong answers", () => {
    expect(skillsWithWrong(result)).toEqual(["listening", "reading"]);
    expect(skillsWithWrong(undefined)).toEqual([]);
  });
});

const SET: QuestionSet = {
  id: "demo",
  kind: "question_set",
  skill: "reading",
  module: "academic",
  title: "Demo",
  difficulty: 1,
  minutes: 10,
  tags: [],
  unlisted: false,
  groups: [
    { type: "tfng", category: "true_false_not_given", instructions: "TFNG", variant: "tfng", questions: [{ n: 1, statement: "Bees can **see** red.", answer: "FALSE", explanation: "They cannot.", evidence: "B" }] },
    { type: "mcq_single", category: "multiple_choice", instructions: "Pick", questions: [{ n: 2, prompt: "Why?", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }], answer: "A" }] },
    { type: "mcq_multi", category: "multiple_choice", instructions: "Two", questions: [{ numbers: [3, 4], prompt: "Which TWO?", options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }, { key: "D", text: "d" }], answers: ["A", "C"], evidence: "line 4" }] },
    { type: "matching", category: "matching_headings", instructions: "Match", allowReuse: false, options: [{ key: "i", text: "x" }, { key: "ii", text: "y" }], questions: [{ n: 5, prompt: "Paragraph A", answer: "ii" }] },
    { type: "completion", category: "sentence_completion", instructions: "Complete", maxWords: 2, allowNumber: true, questions: [{ n: 6, prompt: "The hive holds {{6}} bees.", answers: ["many"] }] },
    {
      type: "completion",
      category: "note_completion",
      instructions: "Notes",
      maxWords: 1,
      allowNumber: true,
      template: "## Notes\n- Colour: {{7}}\n| Size | {{8}} |",
      questions: [{ n: 7, answers: ["red"] }, { n: 8, answers: ["big"] }, { n: 9, answers: ["x"] }],
    },
  ],
};

describe("questionInfo", () => {
  it("finds text, explanation and evidence for every group type", () => {
    expect(questionInfo(SET, 1)).toEqual({ text: "Bees can see red.", explanation: "They cannot.", evidence: "B" });
    expect(questionInfo(SET, 2)?.text).toBe("Why?");
    expect(questionInfo(SET, 4)).toEqual({ text: "Which TWO?", explanation: undefined, evidence: "line 4" });
    expect(questionInfo(SET, 5)?.text).toBe("Paragraph A");
    expect(questionInfo(SET, 6)?.text).toBe("The hive holds ____ bees.");
  });

  it("uses the template line around a blank, or the instructions", () => {
    expect(questionInfo(SET, 7)?.text).toBe("Colour: ____");
    expect(questionInfo(SET, 8)?.text).toBe("Size ____");
    expect(questionInfo(SET, 9)?.text).toBe("Notes");
  });

  it("returns null for unknown numbers", () => {
    expect(questionInfo(SET, 99)).toBeNull();
    expect(hasQuestion(SET, 3)).toBe(true);
    expect(hasQuestion(SET, 99)).toBe(false);
  });

  it("shortens long text", () => {
    const long: QuestionSet = { ...SET, groups: [{ ...SET.groups[1]!, questions: [{ n: 1, prompt: "word ".repeat(100), options: [{ key: "A", text: "a" }, { key: "B", text: "b" }, { key: "C", text: "c" }], answer: "A" }] } as QuestionSet["groups"][number]] };
    const text = questionInfo(long, 1)!.text;
    expect(text.length).toBeLessThanOrEqual(220);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("notebook helpers", () => {
  it("groups by set in first-seen order", () => {
    const out = groupBySet([{ setId: "b", n: 1 }, { setId: "a", n: 2 }, { setId: "b", n: 3 }]);
    expect(out).toEqual([
      { setId: "b", items: [{ setId: "b", n: 1 }, { setId: "b", n: 3 }] },
      { setId: "a", items: [{ setId: "a", n: 2 }] },
    ]);
  });

  it("finds the most missed category by total wrong answers", () => {
    expect(mostMissedCategory([])).toBeNull();
    expect(
      mostMissedCategory([
        { category: "a", timesWrong: 1 },
        { category: "b", timesWrong: 2 },
        { category: "a", timesWrong: 2 },
      ]),
    ).toEqual({ category: "a", count: 3 });
  });

  it("draws streak dots", () => {
    expect(streakDots(0, false)).toEqual([false, false]);
    expect(streakDots(1, false)).toEqual([true, false]);
    expect(streakDots(5, false)).toEqual([true, true]);
    expect(streakDots(-1, false)).toEqual([false, false]);
    expect(streakDots(0, true)).toEqual([true, true]);
  });

  it("counts answered questions and flags unreliable bands", () => {
    expect(answeredCount([{ given: "a" }, { given: "" }, { given: " " }])).toEqual({ answered: 1, total: 3, reliable: false });
    expect(answeredCount([{ given: "a" }, { given: "" }])).toEqual({ answered: 1, total: 2, reliable: true });
    expect(answeredCount([])).toEqual({ answered: 0, total: 0, reliable: false });
  });

  it("round-trips question refs and rejects bad ones", () => {
    expect(questionRef("prd-bees", 7)).toBe("prd-bees#7");
    expect(parseQuestionRef("prd-bees#7")).toEqual({ setId: "prd-bees", n: 7 });
    expect(parseQuestionRef("prd-bees#0")).toBeNull();
    expect(parseQuestionRef("Bad#1")).toBeNull();
    expect(parseQuestionRef("x#1#2")).toBeNull();
    expect(parseQuestionRef("x")).toBeNull();
  });
});
