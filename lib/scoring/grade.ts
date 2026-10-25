import type { QuestionCategory, QuestionGroup, QuestionSet } from "@/lib/content/schema";
import { matchesCompletion, normalizeAnswer } from "./normalize";

/**
 * Answers as the client stores them: keyed by question number. A "choose TWO" item is
 * keyed by its first number and holds an array of letters.
 */
export type AnswerMap = Record<string, string | string[] | undefined>;

export interface GradedItem {
  n: number;
  category: QuestionCategory;
  correct: boolean;
  given: string;
  expected: string;
  explanation?: string;
  evidence?: string;
}

export interface GradeResult {
  raw: number;
  max: number;
  items: GradedItem[];
}

const asText = (v: string | string[] | undefined): string =>
  Array.isArray(v) ? v.join(", ") : (v ?? "");

function gradeGroup(group: QuestionGroup, answers: AnswerMap): GradedItem[] {
  const base = { category: group.category };

  switch (group.type) {
    case "mcq_single":
    case "matching":
      return group.questions.map((q) => {
        const given = asText(answers[q.n]).trim();
        return {
          ...base,
          n: q.n,
          given,
          expected: q.answer,
          correct: given.toLowerCase() === q.answer.toLowerCase(),
          explanation: q.explanation,
          evidence: q.evidence,
        };
      });

    case "tfng":
      return group.questions.map((q) => {
        const given = asText(answers[q.n]).trim().toUpperCase();
        return {
          ...base,
          n: q.n,
          given,
          expected: q.answer,
          correct: given === q.answer,
          explanation: q.explanation,
          evidence: q.evidence,
        };
      });

    case "mcq_multi":
      return group.questions.flatMap((q) => {
        const raw = answers[q.numbers[0]];
        // Never more picks than marks: selecting every option must not score full marks.
        const picked = (Array.isArray(raw) ? raw : raw ? [raw] : []).slice(0, q.numbers.length).map((p) => p.toUpperCase());
        const hits = q.answers.filter((a) => picked.includes(a.toUpperCase()));
        const misses = q.answers.filter((a) => !picked.includes(a.toUpperCase()));
        const wrongPicks = picked.filter((p) => !q.answers.some((a) => a.toUpperCase() === p));
        const expected = [...q.answers].sort().join(", ");

        // Correct letters are awarded to the first numbers, in the order the answer key lists them,
        // so "B, D" on Q3–4 reads naturally on the review screen whatever order they were picked in.
        return q.numbers.map((n, i) => {
          const hit = hits[i];
          return {
            ...base,
            n,
            given: hit ?? wrongPicks[i - hits.length] ?? "",
            expected: i < hits.length ? hit : (misses[i - hits.length] ?? expected),
            correct: hit !== undefined,
            explanation: q.explanation,
            evidence: q.evidence,
          };
        });
      });

    case "completion":
      return group.questions.map((q) => {
        const given = asText(answers[q.n]).trim();
        const correct = group.wordBank
          ? q.answers.some((a) => a.toLowerCase() === normalizeAnswer(given))
          : matchesCompletion(given, q.answers, group);
        return {
          ...base,
          n: q.n,
          given,
          expected: q.answers.join(" / "),
          correct,
          explanation: q.explanation,
          evidence: q.evidence,
        };
      });
  }
}

export function gradeSet(set: QuestionSet, answers: AnswerMap): GradeResult {
  const items = set.groups.flatMap((g) => gradeGroup(g, answers));
  return { raw: items.filter((i) => i.correct).length, max: items.length, items };
}
