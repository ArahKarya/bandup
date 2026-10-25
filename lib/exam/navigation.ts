import type { QuestionSet } from "@/lib/content/schema";
import { setNumbers } from "@/lib/content/check";

/** Question palette, Prev/Next order, flags and the split-pane ratio for the test runner. */

export interface PaletteGroup {
  setIndex: number;
  setId: string;
  label: string;
  numbers: number[];
}

export type SetSkill = "listening" | "reading" | "grammar";

/** "Part 2" for listening, "Passage 1" for reading, the set title otherwise. */
export function setLabel(skill: SetSkill, set: Pick<QuestionSet, "part" | "title">, index: number): string {
  if (skill === "listening") return `Part ${set.part ?? index + 1}`;
  if (skill === "reading") return `Passage ${index + 1}`;
  return set.title;
}

export function paletteGroups(skill: SetSkill, sets: readonly QuestionSet[]): PaletteGroup[] {
  return sets.map((set, i) => ({ setIndex: i, setId: set.id, label: setLabel(skill, set, i), numbers: setNumbers(set) }));
}

/** The neighbouring question in test order, or null at either end (or when `order` is empty). */
export function adjacentNumber(order: readonly number[], current: number | null, dir: 1 | -1): number | null {
  if (order.length === 0) return null;
  if (current === null) return dir === 1 ? order[0] : order[order.length - 1];
  const i = order.indexOf(current);
  if (i < 0) return order[0];
  return order[i + dir] ?? null;
}

/**
 * The number a flag is stored under: the first number of a "choose TWO" item, since the
 * question extras slot hands out that number; the number itself otherwise.
 */
export function flagKey(set: QuestionSet, n: number): number {
  for (const g of set.groups) {
    if (g.type !== "mcq_multi") continue;
    for (const q of g.questions) if (q.numbers.includes(n)) return q.numbers[0];
  }
  return n;
}

export function toggleFlag(flags: readonly number[], n: number): number[] {
  return flags.includes(n) ? flags.filter((x) => x !== n) : [...flags, n].sort((a, b) => a - b);
}

/** First and last question numbers of a set, for "questions 11–20". */
export function numberRange(set: QuestionSet): { from: number; to: number } | null {
  const nums = setNumbers(set);
  if (nums.length === 0) return null;
  return { from: Math.min(...nums), to: Math.max(...nums) };
}

export const SPLIT_MIN = 0.25;
export const SPLIT_MAX = 0.75;
export const SPLIT_DEFAULT = 0.5;
const SPLIT_STEP = 0.02;

export function clampSplit(ratio: number): number {
  if (!Number.isFinite(ratio)) return SPLIT_DEFAULT;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, ratio));
}

/** Keyboard control of the divider (WAI-ARIA window splitter); null for other keys. */
export function splitFromKey(ratio: number, key: string): number | null {
  switch (key) {
    case "ArrowLeft":
      return clampSplit(ratio - SPLIT_STEP);
    case "ArrowRight":
      return clampSplit(ratio + SPLIT_STEP);
    case "Home":
      return SPLIT_MIN;
    case "End":
      return SPLIT_MAX;
    case "Enter":
      return SPLIT_DEFAULT;
    default:
      return null;
  }
}

export function parseSplit(raw: string | null): number {
  if (raw === null) return SPLIT_DEFAULT;
  return clampSplit(Number.parseFloat(raw));
}

/** Seconds as m:ss (or h:mm:ss). */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}

type Answers = Record<string, string | string[] | undefined>;

/** Whether question `n` has an answer; "choose TWO" items count one number per picked option. */
export function isAnswered(set: QuestionSet, answers: Answers, n: number): boolean {
  for (const g of set.groups) {
    if (g.type !== "mcq_multi") continue;
    for (const q of g.questions) {
      const idx = q.numbers.indexOf(n);
      if (idx >= 0) {
        const v = answers[q.numbers[0]];
        return Array.isArray(v) && v.length > idx;
      }
    }
  }
  return String(answers[n] ?? "").trim().length > 0;
}

/** Answered and total question counts over a section's sets. */
export function answerProgress(sets: readonly QuestionSet[], answers: Readonly<Record<string, Answers>>): { answered: number; total: number } {
  let answered = 0;
  let total = 0;
  for (const set of sets) {
    for (const n of setNumbers(set)) {
      total++;
      if (isAnswered(set, answers[set.id] ?? {}, n)) answered++;
    }
  }
  return { answered, total };
}
