import type { QuestionGroup, QuestionSet } from "./schema";

/**
 * A question set cut down to the given question numbers, for drilling mistakes. Numbers are
 * kept as in the original (so "Q7" still points at the same place in the passage), the
 * passage or audio stays whole, and gap-fill templates keep their context with the
 * blanks that are not being drilled shown as a plain line.
 */
export function buildDrillSet(set: QuestionSet, numbers: readonly number[]): QuestionSet {
  const keep = new Set(numbers);
  const groups = set.groups.map((g) => filterGroup(g, keep)).filter((g): g is QuestionGroup => g !== null);
  return { ...set, groups };
}

function filterGroup(group: QuestionGroup, keep: Set<number>): QuestionGroup | null {
  switch (group.type) {
    case "mcq_multi": {
      // A "choose TWO" item is drilled whole if any of its numbers was wrong.
      const questions = group.questions.filter((q) => q.numbers.some((n) => keep.has(n)));
      return questions.length ? { ...group, questions } : null;
    }
    case "completion": {
      const questions = group.questions.filter((q) => keep.has(q.n));
      if (!questions.length) return null;
      const template = group.template?.replace(/\{\{(\d+)\}\}/g, (m, n: string) => (keep.has(Number(n)) ? m : "______"));
      return { ...group, questions, ...(template !== undefined ? { template } : {}) };
    }
    case "mcq_single": {
      const questions = group.questions.filter((q) => keep.has(q.n));
      return questions.length ? { ...group, questions } : null;
    }
    case "tfng": {
      const questions = group.questions.filter((q) => keep.has(q.n));
      return questions.length ? { ...group, questions } : null;
    }
    case "matching": {
      const questions = group.questions.filter((q) => keep.has(q.n));
      return questions.length ? { ...group, questions } : null;
    }
  }
}
