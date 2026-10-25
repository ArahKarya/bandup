import type { QuestionGroup, QuestionSet } from "@/lib/content/schema";
import type { GradedItem } from "@/lib/scoring/grade";

/** Correct answers in a row that master a mistake (matches recordMistakes). */
export const MASTERY_STREAK = 2;

export interface QuestionInfo {
  text: string;
  explanation?: string;
  evidence?: string;
}

const BLANK = /\{\{(\d+)\}\}/g;
const EXCERPT_MAX = 220;

function excerpt(text: string): string {
  const clean = text
    .replace(/\*\*|`/g, "")
    .replace(/^\s*(?:#+|>|[-*])\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(BLANK, "____")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > EXCERPT_MAX ? `${clean.slice(0, EXCERPT_MAX - 1).trimEnd()}…` : clean;
}

/** The line of a gap-fill template that holds blank n, for context. */
function templateLine(template: string, n: number): string | undefined {
  return template.split("\n").find((line) => line.includes(`{{${n}}}`));
}

function inGroup(group: QuestionGroup, n: number): QuestionInfo | null {
  switch (group.type) {
    case "mcq_single":
    case "matching": {
      const q = group.questions.find((x) => x.n === n);
      return q ? { text: excerpt(q.prompt), explanation: q.explanation, evidence: q.evidence } : null;
    }
    case "tfng": {
      const q = group.questions.find((x) => x.n === n);
      return q ? { text: excerpt(q.statement), explanation: q.explanation, evidence: q.evidence } : null;
    }
    case "mcq_multi": {
      const q = group.questions.find((x) => x.numbers.includes(n));
      return q ? { text: excerpt(q.prompt), explanation: q.explanation, evidence: q.evidence } : null;
    }
    case "completion": {
      const q = group.questions.find((x) => x.n === n);
      if (!q) return null;
      const source = q.prompt ?? (group.template ? templateLine(group.template, n) : undefined) ?? group.instructions;
      return { text: excerpt(source), explanation: q.explanation, evidence: q.evidence };
    }
  }
}

/** Question text excerpt, explanation and evidence for question n of a set. */
export function questionInfo(set: QuestionSet, n: number): QuestionInfo | null {
  for (const group of set.groups) {
    const found = inGroup(group, n);
    if (found) return found;
  }
  return null;
}

/** Groups items by set, keeping the order in which each set first appears. */
export function groupBySet<T extends { setId: string }>(items: readonly T[]): { setId: string; items: T[] }[] {
  const order: string[] = [];
  const by = new Map<string, T[]>();
  for (const item of items) {
    const list = by.get(item.setId);
    if (list) by.set(item.setId, [...list, item]);
    else {
      order.push(item.setId);
      by.set(item.setId, [item]);
    }
  }
  return order.map((setId) => ({ setId, items: by.get(setId) ?? [] }));
}

/** The category with the most wrong answers (summed timesWrong), or null when empty. */
export function mostMissedCategory(items: readonly { category: string; timesWrong: number }[]): { category: string; count: number } | null {
  const totals = new Map<string, number>();
  for (const i of items) totals.set(i.category, (totals.get(i.category) ?? 0) + i.timesWrong);
  let best: { category: string; count: number } | null = null;
  for (const [category, count] of totals) if (!best || count > best.count) best = { category, count };
  return best;
}

/** Streak dots: how many of the MASTERY_STREAK dots are filled. */
export function streakDots(correctStreak: number, mastered: boolean): boolean[] {
  const filled = mastered ? MASTERY_STREAK : Math.max(0, Math.min(MASTERY_STREAK, correctStreak));
  return Array.from({ length: MASTERY_STREAK }, (_, i) => i < filled);
}

export interface AnsweredCount {
  answered: number;
  total: number;
  /** Fewer than half answered: a band estimate from this would mislead. */
  reliable: boolean;
}

export function answeredCount(items: readonly Pick<GradedItem, "given">[]): AnsweredCount {
  const answered = items.filter((i) => i.given.trim() !== "").length;
  return { answered, total: items.length, reliable: items.length > 0 && answered * 2 >= items.length };
}

/** Bookmark ref for a question: "<setId>#<n>". */
export function questionRef(setId: string, n: number): string {
  return `${setId}#${n}`;
}

const REF = /^([a-z0-9]+(?:-[a-z0-9]+)*)#([1-9]\d{0,3})$/;

export function parseQuestionRef(ref: string): { setId: string; n: number } | null {
  const m = REF.exec(ref);
  return m ? { setId: m[1]!, n: Number(m[2]) } : null;
}

/** True when question n exists in the set (any group type). */
export function hasQuestion(set: QuestionSet, n: number): boolean {
  return questionInfo(set, n) !== null;
}
