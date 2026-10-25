import { describe, expect, it } from "vitest";
import { buildDrillSet } from "@/lib/content/drill";
import { sanitizeAnnotations, sanitizeAnswers, sanitizeFlags } from "@/lib/attempt/sanitize";
import { drillSections, parseState } from "@/lib/attempt/sections";
import { setNumbers } from "@/lib/content/check";
import { gradeSet } from "@/lib/scoring/grade";
import type { QuestionSet } from "@/lib/content/schema";

const set: QuestionSet = {
  id: "s",
  kind: "question_set",
  skill: "reading",
  module: "academic",
  title: "S",
  difficulty: 1,
  minutes: 10,
  tags: [],
  unlisted: false,
  passage: { title: "P", paragraphs: [{ label: "A", text: "x" }] },
  groups: [
    { type: "tfng", variant: "tfng", category: "true_false_not_given", instructions: "i", questions: [1, 2, 3].map((n) => ({ n, statement: "s", answer: "TRUE" as const })) },
    {
      type: "mcq_multi",
      category: "multiple_choice",
      instructions: "i",
      questions: [{ numbers: [4, 5], prompt: "p", options: ["A", "B", "C", "D"].map((key) => ({ key, text: key })), answers: ["A", "B"] }],
    },
    {
      type: "completion",
      category: "note_completion",
      instructions: "i",
      maxWords: 1,
      allowNumber: true,
      template: "a {{6}} b {{7}}",
      questions: [
        { n: 6, answers: ["x"] },
        { n: 7, answers: ["y"] },
      ],
    },
  ],
};

describe("buildDrillSet", () => {
  it("keeps only the chosen questions with their original numbers", () => {
    const drill = buildDrillSet(set, [2, 7]);
    expect(setNumbers(drill)).toEqual([2, 7]);
    expect(drill.passage).toEqual(set.passage);
  });

  it("drills a choose-TWO item whole when either number was wrong", () => {
    expect(setNumbers(buildDrillSet(set, [5]))).toEqual([4, 5]);
  });

  it("blanks out template gaps that are not being drilled", () => {
    const group = buildDrillSet(set, [7]).groups[0];
    expect(group.type === "completion" && group.template).toBe("a ______ b {{7}}");
  });

  it("grades a drill over just its questions", () => {
    const result = gradeSet(buildDrillSet(set, [1, 6]), { "1": "TRUE", "6": "nope" });
    expect([result.raw, result.max]).toEqual([1, 2]);
  });
});

describe("runner input sanitising", () => {
  it("keeps only numeric keys and bounded values for answers", () => {
    expect(sanitizeAnswers({ "1": "a".repeat(500), x: "no", "2": ["A", 3, "B"], "3": { bad: true } })).toEqual({ "1": "a".repeat(200), "2": ["A", "B"] });
    expect(sanitizeAnswers(null)).toEqual({});
  });

  it("drops malformed annotations and caps note length", () => {
    const out = sanitizeAnnotations([
      { id: "a", block: 0, start: 2, end: 9, kind: "hl" },
      { id: "b", block: 1, start: 0, end: 4, kind: "note", note: "n".repeat(900) },
      { id: "c", block: 0, start: 5, end: 5, kind: "hl" },
      { id: "d", block: -1, start: 0, end: 3, kind: "hl" },
      { id: "e", block: 0, start: 0, end: 3, kind: "script" },
      "junk",
    ]);
    expect(out.map((a) => a.id)).toEqual(["a", "b"]);
    expect(out[1].note).toHaveLength(500);
    expect(out[0]).not.toHaveProperty("note");
    expect(sanitizeAnnotations("nope")).toEqual([]);
  });

  it("dedupes flags and rejects non-question numbers", () => {
    expect(sanitizeFlags([3, 3, 7, 0, -1, 1.5, "4", 2000])).toEqual([3, 7]);
    expect(sanitizeFlags({})).toEqual([]);
  });
});

describe("attempt state", () => {
  it("fills new fields when reading an old row", () => {
    const state = parseState({ section: 1, answers: { s: { "1": "a" } } });
    expect(state.annotations).toEqual({});
    expect(state.flags).toEqual({});
    expect(state.drill).toEqual({});
  });

  it("builds one untimed drill section sized by question count", () => {
    const [section] = drillSections({ a: [1, 2], b: [3, 4, 5, 6] }, "reading");
    expect(section.kind === "sets" && section.setIds).toEqual(["a", "b"]);
    expect(section.kind === "sets" && section.minutes).toBe(9);
  });
});
