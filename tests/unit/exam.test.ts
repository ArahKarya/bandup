import { describe, expect, it } from "vitest";
import type { Annotation } from "@/lib/attempt/sections";
import type { QuestionSet } from "@/lib/content/schema";
import {
  addHighlight,
  addNote,
  annotationsIn,
  byBlock,
  removeAnnotation,
  removeRange,
  segmentText,
  splitSelection,
  trimRange,
  updateNote,
} from "@/lib/exam/annotations";
import {
  adjacentNumber,
  clampSplit,
  flagKey,
  formatClock,
  numberRange,
  paletteGroups,
  parseSplit,
  setLabel,
  splitFromKey,
  SPLIT_DEFAULT,
  SPLIT_MAX,
  SPLIT_MIN,
  toggleFlag,
} from "@/lib/exam/navigation";
import { CONTRAST_VARS, DEFAULT_SETTINGS, parseSettings } from "@/lib/exam/settings";
import { joinAnswers, part2Intro, partOpening, speechTimeoutMs } from "@/lib/exam/speaking";

const hl = (id: string, block: number, start: number, end: number): Annotation => ({ id, block, start, end, kind: "hl" });
const note = (id: string, block: number, start: number, end: number, text = "n"): Annotation => ({ id, block, start, end, kind: "note", note: text });

let counter = 0;
const nextId = () => `new-${++counter}`;

describe("annotation offsets", () => {
  it("trims whitespace from both ends and accepts reversed ranges", () => {
    expect(trimRange("  hello world ", 0, 14)).toEqual({ start: 2, end: 13 });
    expect(trimRange("abc", 3, 1)).toEqual({ start: 1, end: 3 });
    expect(trimRange("a   b", 1, 4)).toBeNull();
  });

  it("splits a selection across paragraphs into one range per block", () => {
    const texts = new Map([
      [0, "First paragraph."],
      [1, "Second one."],
      [2, "Third."],
    ]);
    expect(splitSelection(texts, { block: 0, offset: 6 }, { block: 2, offset: 5 })).toEqual([
      { block: 0, start: 6, end: 16 },
      { block: 1, start: 0, end: 11 },
      { block: 2, start: 0, end: 5 },
    ]);
    // Backwards selection, single block.
    expect(splitSelection(texts, { block: 1, offset: 6 }, { block: 1, offset: 0 })).toEqual([{ block: 1, start: 0, end: 6 }]);
    // Missing blocks are skipped.
    expect(splitSelection(new Map([[0, "x y"]]), { block: 0, offset: 0 }, { block: 3, offset: 1 })).toEqual([{ block: 0, start: 0, end: 3 }]);
  });
});

describe("highlights and notes", () => {
  it("merges overlapping and touching highlights in the same block only", () => {
    const list = [hl("a", 0, 0, 5), hl("b", 0, 10, 15), hl("c", 1, 0, 5)];
    const out = addHighlight(list, { block: 0, start: 4, end: 10 }, "z");
    expect(out).toEqual([hl("a", 0, 0, 15), hl("c", 1, 0, 5)]);
  });

  it("adds a separate highlight when nothing overlaps", () => {
    const out = addHighlight([hl("a", 0, 0, 3)], { block: 0, start: 5, end: 8 }, "z");
    expect(out.map((a) => a.id)).toEqual(["a", "z"]);
  });

  it("does not merge highlights into notes", () => {
    const out = addHighlight([note("n", 0, 0, 5)], { block: 0, start: 2, end: 8 }, "z");
    expect(out).toHaveLength(2);
  });

  it("adds notes and replaces a note on the identical range", () => {
    const one = addNote([], { block: 0, start: 1, end: 4 }, "first", "n1");
    const two = addNote(one, { block: 0, start: 1, end: 4 }, "second", "n2");
    expect(two).toEqual([note("n2", 0, 1, 4, "second")]);
    expect(addNote(two, { block: 0, start: 2, end: 4 }, "other", "n3")).toHaveLength(2);
  });

  it("cuts, splits and removes when a range is cleared", () => {
    const list = [hl("a", 0, 0, 20), note("n", 0, 3, 6), hl("b", 1, 0, 5)];
    const out = removeRange(list, { block: 0, start: 5, end: 10 }, nextId);
    expect(out).toEqual([hl("a", 0, 0, 5), { ...hl("a", 0, 10, 20), id: expect.stringMatching(/^new-/) }, hl("b", 1, 0, 5)]);
    // Clearing the start of a highlight keeps its id on the remaining piece.
    expect(removeRange([hl("a", 0, 0, 10)], { block: 0, start: 0, end: 4 }, nextId)).toEqual([hl("a", 0, 4, 10)]);
    // Fully covered highlight disappears.
    expect(removeRange([hl("a", 0, 2, 4)], { block: 0, start: 0, end: 9 }, nextId)).toEqual([]);
  });

  it("removes by id, edits notes and finds annotations in a range", () => {
    const list = [hl("a", 0, 0, 5), note("n", 0, 3, 8)];
    expect(removeAnnotation(list, "a")).toEqual([note("n", 0, 3, 8)]);
    expect(updateNote(list, "n", "edited")[1].note).toBe("edited");
    expect(updateNote(list, "a", "x")[0]).toEqual(hl("a", 0, 0, 5));
    expect(annotationsIn(list, { block: 0, start: 6, end: 7 }).map((a) => a.id)).toEqual(["n"]);
    expect(annotationsIn(list, { block: 1, start: 0, end: 9 })).toEqual([]);
    expect(list).toHaveLength(2); // inputs untouched
  });

  it("groups annotations by block", () => {
    const map = byBlock([hl("a", 0, 0, 1), hl("b", 2, 0, 1), hl("c", 0, 3, 4)]);
    expect(map.get(0)?.map((a) => a.id)).toEqual(["a", "c"]);
    expect(map.get(1)).toBeUndefined();
  });
});

describe("segmentText", () => {
  const text = "The quick brown fox jumps";

  it("returns the whole text when there is nothing to draw", () => {
    expect(segmentText(text, [])).toEqual([{ text, start: 0, end: text.length, marks: [] }]);
    expect(segmentText("", [])).toEqual([]);
  });

  it("cuts at every boundary of overlapping highlights and notes", () => {
    const segs = segmentText(text, [hl("a", 0, 4, 15), note("n", 0, 10, 19)]);
    expect(segs.map((s) => s.text)).toEqual(["The ", "quick ", "brown", " fox", " jumps"]);
    expect(segs.map((s) => s.marks.map((m) => m.id))).toEqual([[], ["a"], ["a", "n"], ["n"], []]);
    expect(segs.map((s) => s.text).join("")).toBe(text);
  });

  it("clamps stale offsets and drops empty annotations", () => {
    const segs = segmentText("short", [hl("a", 0, 2, 99), hl("b", 0, 40, 50)]);
    expect(segs).toEqual([
      { text: "sh", start: 0, end: 2, marks: [] },
      { text: "ort", start: 2, end: 5, marks: [hl("a", 0, 2, 5)] },
    ]);
  });

  it("orders highlights before notes on a shared segment", () => {
    const segs = segmentText("abcdef", [note("n", 0, 0, 6), hl("a", 0, 0, 6)]);
    expect(segs).toHaveLength(1);
    expect(segs[0].marks.map((m) => m.kind)).toEqual(["hl", "note"]);
  });
});

const set = {
  id: "s1",
  title: "Grammar basics",
  part: 2,
  groups: [
    { type: "tfng", questions: [{ n: 1 }, { n: 2 }] },
    { type: "mcq_multi", questions: [{ numbers: [3, 4] }] },
    { type: "completion", questions: [{ n: 5 }] },
  ],
} as unknown as QuestionSet;

describe("navigation", () => {
  it("labels sets like the real test", () => {
    expect(setLabel("listening", set, 0)).toBe("Part 2");
    expect(setLabel("listening", { ...set, part: undefined }, 2)).toBe("Part 3");
    expect(setLabel("reading", set, 0)).toBe("Passage 1");
    expect(setLabel("grammar", set, 0)).toBe("Grammar basics");
  });

  it("builds palette groups and question ranges", () => {
    expect(paletteGroups("reading", [set])).toEqual([{ setIndex: 0, setId: "s1", label: "Passage 1", numbers: [1, 2, 3, 4, 5] }]);
    expect(numberRange(set)).toEqual({ from: 1, to: 5 });
    expect(numberRange({ ...set, groups: [] } as QuestionSet)).toBeNull();
  });

  it("moves to the adjacent question and stops at the ends", () => {
    const order = [1, 2, 3];
    expect(adjacentNumber(order, 2, 1)).toBe(3);
    expect(adjacentNumber(order, 2, -1)).toBe(1);
    expect(adjacentNumber(order, 3, 1)).toBeNull();
    expect(adjacentNumber(order, null, 1)).toBe(1);
    expect(adjacentNumber(order, null, -1)).toBe(3);
    expect(adjacentNumber(order, 9, 1)).toBe(1);
    expect(adjacentNumber([], 1, 1)).toBeNull();
  });

  it("stores flags under the first number of a choose-TWO item", () => {
    expect(flagKey(set, 4)).toBe(3);
    expect(flagKey(set, 5)).toBe(5);
    expect(toggleFlag([5, 1], 3)).toEqual([1, 3, 5]);
    expect(toggleFlag([1, 3], 3)).toEqual([1]);
  });

  it("clamps and steps the split ratio", () => {
    expect(clampSplit(0.1)).toBe(SPLIT_MIN);
    expect(clampSplit(0.9)).toBe(SPLIT_MAX);
    expect(clampSplit(Number.NaN)).toBe(SPLIT_DEFAULT);
    expect(splitFromKey(0.5, "ArrowRight")).toBeCloseTo(0.52);
    expect(splitFromKey(0.5, "ArrowLeft")).toBeCloseTo(0.48);
    expect(splitFromKey(0.5, "Home")).toBe(SPLIT_MIN);
    expect(splitFromKey(0.5, "End")).toBe(SPLIT_MAX);
    expect(splitFromKey(0.3, "Enter")).toBe(SPLIT_DEFAULT);
    expect(splitFromKey(0.5, "a")).toBeNull();
    expect(parseSplit(null)).toBe(SPLIT_DEFAULT);
    expect(parseSplit("0.6")).toBe(0.6);
    expect(parseSplit("junk")).toBe(SPLIT_DEFAULT);
  });

  it("formats clocks", () => {
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("exam settings", () => {
  it("parses stored settings defensively", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("{bad json")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("42")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(JSON.stringify({ textSize: "l", contrast: "yellow-black", font: "sans" }))).toEqual({ textSize: "l", contrast: "yellow-black", font: "sans" });
    expect(parseSettings(JSON.stringify({ textSize: "xl", contrast: 3 }))).toEqual(DEFAULT_SETTINGS);
  });

  it("defines readable highlight colours for each contrast scheme", () => {
    expect(CONTRAST_VARS.standard).toEqual({});
    expect(CONTRAST_VARS["yellow-black"]["--mark"]).not.toBe(CONTRAST_VARS["yellow-black"]["--text"]);
    expect(CONTRAST_VARS["black-cream"]["--text"]).toBe("#000000");
  });
});

describe("speaking examiner script", () => {
  it("reads the cue card in the Part 2 introduction", () => {
    const intro = part2Intro({ prompt: "Describe a park.", bullets: ["where it is", "why you go"], closing: "and explain how you feel." });
    expect(intro).toContain("Describe a park.");
    expect(intro).toContain("where it is; why you go");
    expect(intro.endsWith("and explain how you feel.")).toBe(true);
  });

  it("opens Parts 1 and 3 on the topic", () => {
    expect(partOpening(1, "your hometown")).toBe("Let's talk about your hometown.");
    expect(partOpening(3, "travel")).toContain("travel");
    expect(partOpening(2, "x")).toBe("");
  });

  it("joins answers one per line and drops empty ones", () => {
    expect(joinAnswers(["  Hello   there ", "", "Second\nanswer"])).toBe("Hello there\nSecond answer");
  });

  it("estimates a speech timeout from word count and rate", () => {
    expect(speechTimeoutMs("one two three")).toBeGreaterThan(2500);
    expect(speechTimeoutMs("a b c d e f g h", 2)).toBeLessThan(speechTimeoutMs("a b c d e f g h", 1));
  });
});

describe("fill", () => {
  it("replaces known placeholders only", async () => {
    const { fill } = await import("@/lib/exam/text");
    expect(fill("Questions {from}–{to} {x}", { from: 1, to: 5 })).toBe("Questions 1–5 {x}");
  });
});

describe("answer progress", () => {
  it("counts plain answers and choose-TWO picks", async () => {
    const { answerProgress, isAnswered } = await import("@/lib/exam/navigation");
    const answers = { s1: { 1: "TRUE", 2: "  ", 3: ["A"], 5: "river" } };
    expect(isAnswered(set, answers.s1, 3)).toBe(true);
    expect(isAnswered(set, answers.s1, 4)).toBe(false);
    expect(isAnswered(set, answers.s1, 2)).toBe(false);
    expect(answerProgress([set], answers)).toEqual({ answered: 3, total: 5 });
    expect(answerProgress([set], {})).toEqual({ answered: 0, total: 5 });
  });
});
