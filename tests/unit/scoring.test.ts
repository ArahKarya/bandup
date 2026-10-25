import { describe, expect, it } from "vitest";
import {
  listeningBand,
  overallBand,
  readingBand,
  scaledBand,
  speakingBand,
  taskBand,
  writingBand,
} from "@/lib/scoring/band";
import { matchesCompletion, normalizeAnswer } from "@/lib/scoring/normalize";
import { gradeSet } from "@/lib/scoring/grade";
import type { QuestionSet } from "@/lib/content/schema";

describe("normalizeAnswer", () => {
  it("ignores case, outer punctuation and extra spaces", () => {
    expect(normalizeAnswer("  The  River. ")).toBe("the river");
    expect(normalizeAnswer("“Bus-stop”")).toBe("bus-stop");
  });

  it("tightens spacing around hyphens", () => {
    expect(normalizeAnswer("well - known")).toBe("well-known");
  });

  it("strips currency and thousands separators from numbers", () => {
    expect(normalizeAnswer("£1,200")).toBe("1200");
  });
});

describe("matchesCompletion", () => {
  const rule = { maxWords: 2, allowNumber: true };

  it("accepts any listed variant", () => {
    expect(matchesCompletion("14th", ["14", "14th"], rule)).toBe(true);
    expect(matchesCompletion("Colour", ["colour", "color"], rule)).toBe(true);
  });

  it("rejects an answer longer than the word limit even if it contains the key", () => {
    expect(matchesCompletion("the red car", ["red car"], rule)).toBe(false);
  });

  it("treats a hyphen and a space as equivalent", () => {
    expect(matchesCompletion("well known", ["well-known"], rule)).toBe(true);
  });

  it("allows a number on top of the word limit when the rule says AND/OR A NUMBER", () => {
    const one = { maxWords: 1, allowNumber: true };
    expect(matchesCompletion("14 March", ["14 March"], one)).toBe(true);
    expect(matchesCompletion("14 March", ["14 March"], { maxWords: 1, allowNumber: false })).toBe(false);
    expect(matchesCompletion("late March", ["late March"], one)).toBe(false);
    expect(matchesCompletion("sixty-six", ["sixty-six"], one)).toBe(true);
  });

  it("rejects empty input", () => {
    expect(matchesCompletion("   ", ["x"], rule)).toBe(false);
  });
});

describe("band conversion", () => {
  it("converts listening raw scores", () => {
    expect(listeningBand(40)).toBe(9);
    expect(listeningBand(30)).toBe(7);
    expect(listeningBand(23)).toBe(6);
    expect(listeningBand(0)).toBe(0);
  });

  it("uses different tables for academic and general reading", () => {
    expect(readingBand(30, "academic")).toBe(7);
    expect(readingBand(30, "general")).toBe(6);
    expect(readingBand(40, "general")).toBe(9);
  });

  it("scales short practice sets to the 40-mark table", () => {
    expect(scaledBand(10, 10, "listening")).toBe(9);
    expect(scaledBand(5, 10, "reading", "academic")).toBe(readingBand(20, "academic"));
    expect(scaledBand(0, 0, "listening")).toBe(0);
  });
});

describe("rounding", () => {
  it("rounds the overall band the IELTS way", () => {
    expect(overallBand([6.5, 6.5, 5, 7])).toBe(6.5); // 6.25 → 6.5
    expect(overallBand([6.5, 6.5, 5.5, 6])).toBe(6); // 6.125 → 6
    expect(overallBand([7, 7, 6.5, 6.5])).toBe(7); // 6.75 → 7
    expect(overallBand([6, 6, 6, 6.5])).toBe(6); // 6.125 → 6
  });

  it("averages criteria down to the half band below", () => {
    expect(taskBand({ ta: 7, cc: 6, lr: 6, gra: 6 })).toBe(6); // 6.25
    expect(taskBand({ ta: 7, cc: 7, lr: 6, gra: 7 })).toBe(6.5); // 6.75
  });

  it("weights writing task 2 double", () => {
    expect(writingBand(6, 7)).toBe(6.5); // 6.67
    expect(writingBand(7, 6)).toBe(6.5); // 6.33
  });

  it("averages speaking criteria", () => {
    expect(speakingBand({ fc: 7, lr: 7, gra: 6, p: 7 })).toBe(6.5);
  });
});

const set: QuestionSet = {
  id: "t",
  kind: "question_set",
  skill: "reading",
  module: "academic",
  title: "t",
  difficulty: 1,
  minutes: 5,
  tags: [],
  unlisted: false,
  passage: { title: "p", paragraphs: [{ text: "x" }] },
  groups: [
    {
      type: "tfng",
      variant: "tfng",
      category: "true_false_not_given",
      instructions: "i",
      questions: [
        { n: 1, statement: "s", answer: "TRUE" },
        { n: 2, statement: "s", answer: "NOT GIVEN" },
      ],
    },
    {
      type: "mcq_multi",
      category: "multiple_choice",
      instructions: "i",
      questions: [
        {
          numbers: [3, 4],
          prompt: "p",
          options: [
            { key: "A", text: "a" },
            { key: "B", text: "b" },
            { key: "C", text: "c" },
            { key: "D", text: "d" },
          ],
          answers: ["B", "D"],
        },
      ],
    },
    {
      type: "completion",
      category: "summary_completion",
      instructions: "i",
      maxWords: 1,
      allowNumber: true,
      template: "{{5}}",
      questions: [{ n: 5, answers: ["honey"] }],
    },
  ],
};

describe("gradeSet", () => {
  it("marks each question and totals the raw score", () => {
    const result = gradeSet(set, { "1": "TRUE", "2": "FALSE", "3": ["D", "A"], "5": "Honey" });
    expect(result.max).toBe(5);
    expect(result.raw).toBe(3);
    expect(result.items.map((i) => i.correct)).toEqual([true, false, true, false, true]);
  });

  it("only counts as many picks as there are marks", () => {
    expect(gradeSet(set, { "3": ["B", "D", "A"] }).items.filter((i) => i.correct)).toHaveLength(2);
    // Picking every option is truncated to the first two picks.
    expect(gradeSet(set, { "3": ["A", "C", "B", "D"] }).items.filter((i) => i.correct)).toHaveLength(0);
  });

  it("counts unanswered questions as wrong with an empty given value", () => {
    const result = gradeSet(set, {});
    expect(result.raw).toBe(0);
    expect(result.items[0].given).toBe("");
  });

  it("reports the category of every item for analytics", () => {
    const result = gradeSet(set, {});
    expect(result.items.map((i) => i.category)).toEqual([
      "true_false_not_given",
      "true_false_not_given",
      "multiple_choice",
      "multiple_choice",
      "summary_completion",
    ]);
  });
});
