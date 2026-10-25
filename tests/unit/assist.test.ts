import { describe, expect, it } from "vitest";
import { analyzeWriting } from "@/lib/writing/analyze";
import { findContractions, taskChecklist } from "@/lib/writing/checklist";
import { findLinkingDevices, summariseLinking } from "@/lib/writing/linking";
import { detectGreeting, detectSignOff } from "@/lib/writing/letters";
import { appendBlock, insertAtCursor } from "@/lib/writing/insert";
import { initialPlan, isPlanEmpty, outlineFromPlan, parsePlan, PLAN_FIELDS } from "@/lib/writing/planner";
import { phraseBank } from "@/lib/writing/phrases";
import { correctionsFromFeedback, locateCorrections, parseCorrections, segment } from "@/lib/writing/segments";
import { isFormalRegister, writingContext, type WritingContext } from "@/lib/writing/task-kind";
import { lemma, repeatedWords, splitParagraphs, splitSentences, tokenize } from "@/lib/writing/text";
import {
  countFillers, diversityLevel, fillerLevel, movingAverageTtr, speakingMetrics, typeTokenRatio, wpmLevel,
} from "@/lib/speaking/metrics";

const ESSAY: WritingContext = { kind: "essay", minWords: 250, essayType: "opinion" };
const REPORT: WritingContext = { kind: "report", minWords: 150 };
const FORMAL_LETTER: WritingContext = { kind: "letter", minWords: 150, tone: "formal" };
const check = (checks: ReturnType<typeof taskChecklist>, id: string) => checks.find((c) => c.id === id);

describe("text helpers", () => {
  it("tokenises words with apostrophes and hyphens", () => {
    expect(tokenize("It’s a well-known FACT, isn't it?")).toEqual(["it's", "a", "well-known", "fact", "isn't", "it"]);
  });

  it("splits sentences but keeps abbreviations together", () => {
    expect(splitSentences("Prices rose, e.g. in 2010. Then they fell! Why?\nNew line")).toEqual([
      "Prices rose, e.g. in 2010.", "Then they fell!", "Why?", "New line",
    ]);
  });

  it("splits paragraphs on line breaks and drops blank lines", () => {
    expect(splitParagraphs("One.\n\n  \nTwo.\nThree.")).toEqual(["One.", "Two.", "Three."]);
  });

  it("folds simple plurals", () => {
    expect(["cities", "boxes", "cars", "bus", "analysis", "dogs", "ox"].map(lemma)).toEqual(["city", "box", "car", "bus", "analysis", "dog", "ox"]);
  });

  it("finds repeated content words, ignoring stopwords", () => {
    const words = tokenize("The car is fast. Cars are popular. A car costs money. The the the.");
    expect(repeatedWords(words)).toEqual([{ word: "car", count: 3 }]);
  });
});

describe("linking devices", () => {
  it("prefers the longest phrase and reports positions", () => {
    const text = "However, because of traffic. On the other hand, it helps.";
    const found = findLinkingDevices(text);
    expect(found.map((m) => m.phrase)).toEqual(["however", "because of", "on the other hand"]);
    expect(text.slice(found[1].start, found[1].end)).toBe("because of");
  });

  it("does not match inside words", () => {
    expect(findLinkingDevices("Butter thusly overallness")).toEqual([]);
  });

  it("summarises variety by function", () => {
    const s = summariseLinking("Firstly, x. However, y. However, z. In conclusion, w.");
    expect(s.total).toBe(4);
    expect(s.distinct).toBe(3);
    expect(s.functionsUsed).toBe(3);
    expect(s.byFunction.contrast).toEqual([{ phrase: "however", count: 2 }]);
  });
});

describe("task context", () => {
  it("derives kind, tone and essay type", () => {
    expect(writingContext({ task: 1, taskType: "line_graph", minWords: 150 })).toEqual({ kind: "report", minWords: 150 });
    expect(writingContext({ task: 1, taskType: "letter_informal", minWords: 150 })).toMatchObject({ kind: "letter", tone: "informal" });
    expect(writingContext({ task: 1, taskType: "letter_semi_formal", minWords: 150 }).tone).toBe("semi");
    expect(writingContext({ task: 2, taskType: "discussion", minWords: 250 })).toMatchObject({ kind: "essay", essayType: "discussion" });
    expect(writingContext({ task: 2, taskType: "line_graph", minWords: 250 }).essayType).toBe("opinion");
    expect(isFormalRegister({ kind: "letter", tone: "informal" })).toBe(false);
    expect(isFormalRegister({ kind: "essay" })).toBe(true);
  });
});

describe("checklist", () => {
  it("returns nothing for empty text", () => {
    expect(analyzeWriting("   ", ESSAY).checks).toEqual([]);
  });

  it("checks a report for an overview and no opinion", () => {
    const good = analyzeWriting("The graph shows sales. Overall, sales rose.", REPORT).checks;
    expect(check(good, "overview")?.pass).toBe(true);
    expect(check(good, "noOpinion")?.pass).toBe(true);
    const bad = analyzeWriting("The graph shows sales. I think sales rose.", REPORT).checks;
    expect(check(bad, "overview")?.pass).toBe(false);
    expect(check(bad, "noOpinion")?.pass).toBe(false);
  });

  it("checks an essay for a position and four paragraphs", () => {
    const text = "Intro. In my opinion, yes.\nBody one.\nBody two.\nIn conclusion, yes.";
    const checks = analyzeWriting(text, ESSAY).checks;
    expect(check(checks, "position")?.pass).toBe(true);
    expect(check(checks, "paragraphs")).toMatchObject({ pass: true, params: { count: 4 } });
    const noPos = analyzeWriting("Some say so.", { ...ESSAY, essayType: "problem_solution" }).checks;
    expect(check(noPos, "position")).toMatchObject({ pass: false, severity: "info" });
  });

  it("flags under- and over-length answers", () => {
    const short = analyzeWriting("word ".repeat(100), REPORT).checks;
    expect(check(short, "minLength")).toMatchObject({ pass: false, params: { n: 150, words: 100 } });
    expect(check(short, "maxLength")).toBeUndefined();
    const long = analyzeWriting("word ".repeat(240), REPORT).checks;
    expect(check(long, "minLength")?.pass).toBe(true);
    expect(check(long, "maxLength")).toMatchObject({ pass: false, severity: "info", params: { n: 225 } });
  });

  it("finds contractions but not possessives, and skips informal letters", () => {
    expect(findContractions("It's true the government's plan won't work and they're late.")).toEqual(["it's", "won't", "they're"]);
    const informal = analyzeWriting("Hi Sam,\nIt's great.\nBest wishes,\nAnna", { kind: "letter", minWords: 150, tone: "informal" }).checks;
    expect(check(informal, "contractions")).toBeUndefined();
    const formal = analyzeWriting("Overall it's clear.", REPORT).checks;
    expect(check(formal, "contractions")).toMatchObject({ pass: false, params: { list: "it's" } });
  });

  it("matches letter greetings with sign-offs", () => {
    const ok = analyzeWriting("Dear Sir or Madam,\nI am writing to complain.\nYours faithfully,\nAnna Lee", FORMAL_LETTER).checks;
    expect(["greeting", "greetingTone", "signOff", "signOffMatch"].map((id) => check(ok, id)?.pass)).toEqual([true, true, true, true]);

    const mismatch = analyzeWriting("Dear Mr Brown,\nI am writing.\nYours faithfully,\nAnna", FORMAL_LETTER).checks;
    expect(check(mismatch, "greetingTone")?.pass).toBe(false);
    expect(check(mismatch, "signOffMatch")).toMatchObject({ pass: false, params: { expected: "Yours sincerely" } });

    const missing = analyzeWriting("I am writing to complain about the noise.", FORMAL_LETTER).checks;
    expect(check(missing, "greeting")?.pass).toBe(false);
    expect(check(missing, "signOff")).toMatchObject({ pass: false, params: { expected: "Yours faithfully" } });
  });

  it("detects informal greetings and closes", () => {
    expect(detectGreeting(["Hi Sam,"])).toEqual({ text: "Hi Sam", tone: "informal" });
    expect(detectGreeting(["Hello!"])?.tone).toBe("informal");
    expect(detectGreeting([])).toBeNull();
    expect(detectSignOff(["text", "Best wishes,", "Anna", "P.S. call me"])?.tone).toBe("informal");
    expect(detectSignOff(["Kind regards,", "Anna"])?.tone).toBe("semi");
    expect(detectSignOff(["no close here"])).toBeNull();
  });
});

describe("analyzeWriting", () => {
  it("counts paragraphs, sentences and long sentences", () => {
    const long = `${"word ".repeat(45).trim()}.`;
    const a = analyzeWriting(`First short one. Second one here.\n${long}`, ESSAY);
    expect(a.paragraphs).toEqual([{ index: 0, words: 6 }, { index: 1, words: 45 }]);
    expect(a.sentences).toBe(3);
    expect(a.avgSentenceLength).toBe(17);
    expect(a.longestSentence?.words).toBe(45);
    expect(a.longSentences).toBe(1);
  });

  it("handles empty text", () => {
    const a = analyzeWriting("", ESSAY);
    expect(a).toMatchObject({ words: 0, sentences: 0, avgSentenceLength: 0, longestSentence: null, paragraphs: [] });
  });
});

describe("planner", () => {
  it("has fields for every kind", () => {
    expect(PLAN_FIELDS.report.map((f) => f.id)).toContain("overview");
    expect(PLAN_FIELDS.letter.map((f) => f.id)).toContain("tone");
    expect(PLAN_FIELDS.essay.map((f) => f.id)).toContain("position");
  });

  it("starts with the task's tone or question type", () => {
    expect(initialPlan(FORMAL_LETTER)).toEqual({ tone: "formal" });
    expect(initialPlan(ESSAY)).toEqual({ questionType: "opinion" });
    expect(initialPlan(REPORT)).toEqual({});
    expect(initialPlan({ kind: "letter", minWords: 150 })).toEqual({ tone: "formal" });
  });

  it("parses stored plans defensively", () => {
    expect(parsePlan(null)).toEqual({});
    expect(parsePlan([1])).toEqual({});
    expect(parsePlan({ position: "Yes", hacker: "x", body1: 3 })).toEqual({ position: "Yes" });
    expect(parsePlan({ position: "x".repeat(5000) }).position).toHaveLength(2000);
  });

  it("knows when a plan is empty", () => {
    expect(isPlanEmpty({ tone: "formal", purpose: "  " })).toBe(true);
    expect(isPlanEmpty({ purpose: "complain" })).toBe(false);
  });

  it("builds an essay outline with placeholders", () => {
    const outline = outlineFromPlan(ESSAY, { position: "Cities should ban cars.", body1: "Pollution falls" });
    const paras = outline.split("\n\n");
    expect(paras).toHaveLength(4);
    expect(paras[0]).toContain("Cities should ban cars.");
    expect(paras[1]).toBe("Firstly, pollution falls. [explanation and example].");
    expect(paras[3]).toBe("In conclusion, [restate your position].");
  });

  it("builds report and letter outlines", () => {
    expect(outlineFromPlan(REPORT, { overview: "Sales rose" })).toContain("Overall, sales rose.");
    const letter = outlineFromPlan(FORMAL_LETTER, { tone: "informal", purpose: "invite you" });
    expect(letter.startsWith("Dear …,")).toBe(true);
    expect(letter).toContain("I am writing to invite you.");
    expect(letter).toContain("Best wishes,\n[Your name]");
    const custom = outlineFromPlan(FORMAL_LETTER, { opening: "Dear Ms Lee", closing: "Kind regards" });
    expect(custom.startsWith("Dear Ms Lee,")).toBe(true);
    expect(custom).toContain("Kind regards,");
    expect(outlineFromPlan(FORMAL_LETTER, { tone: "bogus" })).toContain("Yours faithfully,");
  });
});

describe("phrase bank", () => {
  it("offers groups per task kind and letter tone", () => {
    expect(phraseBank(REPORT).map((g) => g.id)).toEqual(["overview", "increase", "decrease", "comparison", "sequence"]);
    expect(phraseBank(ESSAY).map((g) => g.id)).toContain("concession");
    expect(phraseBank(FORMAL_LETTER)[0].phrases).toContain("Dear Sir or Madam,");
    expect(phraseBank(FORMAL_LETTER, "informal")[2].phrases).toContain("Best wishes,");
  });
});

describe("insertAtCursor", () => {
  it("adds spaces where needed", () => {
    expect(insertAtCursor("Hello world", 5, 5, "big")).toEqual({ value: "Hello big world", caret: 9 });
    expect(insertAtCursor("Hello ", 6, 6, "there")).toEqual({ value: "Hello there", caret: 11 });
    expect(insertAtCursor("Hi.", 2, 2, "you")).toEqual({ value: "Hi you.", caret: 6 });
    expect(insertAtCursor("", 10, 10, "x")).toEqual({ value: "x", caret: 1 });
  });

  it("replaces a selection", () => {
    expect(insertAtCursor("a bad idea", 2, 5, "good").value).toBe("a good idea");
  });

  it("appends blocks after a blank line", () => {
    expect(appendBlock("", "Outline")).toEqual({ value: "Outline", caret: 7 });
    expect(appendBlock("Text\n\n", "Outline").value).toBe("Text\n\nOutline");
  });
});

describe("corrections", () => {
  it("parses stored corrections defensively", () => {
    expect(parseCorrections("nope")).toEqual([]);
    expect(parseCorrections([null, { original: "a" }, { original: " ", suggestion: "b" }, { original: "x", suggestion: "y", note: "" }])).toEqual([
      { original: "x", suggestion: "y" },
    ]);
    expect(parseCorrections([{ original: "x", suggestion: "y", note: "n" }])).toEqual([{ original: "x", suggestion: "y", note: "n" }]);
  });

  it("reads corrections from stored feedback", () => {
    expect(correctionsFromFeedback(null)).toEqual([]);
    expect(correctionsFromFeedback("x")).toEqual([]);
    expect(correctionsFromFeedback({ corrections: [{ original: "a", suggestion: "b" }] })).toEqual([{ original: "a", suggestion: "b" }]);
  });

  it("locates the first occurrence, ignoring case and whitespace", () => {
    const text = "People  Is happy. people is happy. They was late.";
    const ranges = locateCorrections(text, [
      { original: "people is", suggestion: "people are" },
      { original: "people is", suggestion: "again" },
      { original: "they was", suggestion: "they were" },
      { original: "not there", suggestion: "x" },
    ]);
    expect(ranges.map((r) => [text.slice(r.start, r.end), r.ref])).toEqual([["People  Is", 0], ["people is", 1], ["They was", 2]]);
  });

  it("respects word boundaries", () => {
    expect(locateCorrections("cartoon", [{ original: "car", suggestion: "x" }])).toEqual([]);
    expect(locateCorrections("a (b) c", [{ original: "(b)", suggestion: "x" }])).toHaveLength(1);
  });

  it("segments text around ranges", () => {
    expect(segment("abcdef", [{ start: 2, end: 4, ref: 0 }, { start: 3, end: 5, ref: 1 }, { start: 9, end: 12, ref: 2 }])).toEqual([
      { text: "ab", ref: null }, { text: "cd", ref: 0 }, { text: "ef", ref: null },
    ]);
    expect(segment("ab", [{ start: 0, end: 2, ref: 0 }])).toEqual([{ text: "ab", ref: 0 }]);
  });
});

describe("speaking metrics", () => {
  it("counts fillers with heuristics for like, kind of and you know", () => {
    const items = countFillers("Um, I like football. It was, like, huge, you know. What kind of music? It's kind of hard. Uh, I mean, basically yes. You know what I mean.");
    const map = Object.fromEntries(items.map((f) => [f.filler, f.count]));
    expect(map).toEqual({ um: 1, uh: 1, like: 1, "you know": 1, "i mean": 1, "kind of": 1, basically: 1 });
  });

  it("counts doubled like and like next to hesitations", () => {
    const map = Object.fromEntries(countFillers("it was like like um like big").map((f) => [f.filler, f.count]));
    expect(map.like).toBe(3);
    expect(map.um).toBe(1);
  });

  it("computes words per minute and filler rates", () => {
    const m = speakingMetrics("um ".repeat(10) + "word ".repeat(140), 60);
    expect(m.words).toBe(150);
    expect(m.wpm).toBe(150);
    expect(m.fillers).toMatchObject({ total: 10, per100Words: 6.7, perMinute: 10 });
    expect(m.sentences).toBeNull();
    expect(m.avgSentenceLength).toBeNull();
  });

  it("has no rate without a duration", () => {
    const m = speakingMetrics("Hello there. I live in Jakarta.", 0);
    expect(m.wpm).toBeNull();
    expect(m.durationSec).toBeNull();
    expect(m.fillers.perMinute).toBeNull();
    expect(m.sentences).toBe(2);
    expect(m.avgSentenceLength).toBe(3);
  });

  it("handles an empty transcript", () => {
    const m = speakingMetrics("", 30);
    expect(m).toMatchObject({ words: 0, wpm: null, ttr: null, mattr: null });
    expect(m.fillers.per100Words).toBe(0);
  });

  it("computes type-token ratio and MATTR", () => {
    expect(typeTokenRatio([])).toBeNull();
    expect(typeTokenRatio(["a", "a", "b", "c"])).toBe(0.75);
    expect(movingAverageTtr(["a", "b"], 3)).toBe(1);
    // windows: [a b a]=2/3, [b a c]=1, [a c c]=2/3
    expect(movingAverageTtr(["a", "b", "a", "c", "c"], 3)).toBeCloseTo((2 / 3 + 1 + 2 / 3) / 3);
    const varied = Array.from({ length: 120 }, (_, i) => `w${i % 60}`);
    expect(speakingMetrics(varied.join(" "), 60).mattr).toBe(1);
  });

  it("classifies levels", () => {
    expect([90, 140, 200].map(wpmLevel)).toEqual(["low", "ok", "high"]);
    expect([2, 8].map(fillerLevel)).toEqual(["ok", "high"]);
    expect([0.5, 0.7, 0.8].map(diversityLevel)).toEqual(["low", "ok", "high"]);
  });
});
