import { withinWordLimit } from "@/lib/content/check";

/**
 * Normalises a typed answer for comparison. Examiners accept answers regardless of case,
 * and a hyphenated and spaced form of the same compound; content authors list any other
 * accepted variants (spelling, number forms) explicitly.
 */
export function normalizeAnswer(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”"]/g, "")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/[£$€¥]/g, "")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.,;:!?'()]+|[.,;:!?'()]+$/g, "")
    .trim();
}

/** Comparison key that also treats "well-known" and "well known" as the same answer. */
function compareKey(raw: string): string {
  return normalizeAnswer(raw).replace(/-/g, " ");
}

export interface CompletionRule {
  maxWords: number;
  allowNumber: boolean;
}

/** True when `given` is one of the accepted answers and respects the word limit. */
export function matchesCompletion(given: string, accepted: string[], rule: CompletionRule): boolean {
  const key = compareKey(given);
  if (!key) return false;
  // Count on the hyphenated form: "sixty-six" is one word.
  if (!withinWordLimit(normalizeAnswer(given), rule.maxWords, rule.allowNumber)) return false;
  return accepted.some((a) => compareKey(a) === key);
}
