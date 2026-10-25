import { phrasePattern } from "./text";

/** Splitting text into marked and unmarked runs, for highlights that render without innerHTML. */

export interface Range {
  start: number;
  end: number;
  /** Caller's id for the range (e.g. the correction index). */
  ref: number;
}

export interface Segment {
  text: string;
  ref: number | null;
}

/** Cuts `text` at the given ranges; overlapping or out-of-bounds ranges are skipped. */
export function segment(text: string, ranges: readonly Range[]): Segment[] {
  const sorted = [...ranges].filter((r) => r.start >= 0 && r.end <= text.length && r.end > r.start).sort((a, b) => a.start - b.start);
  const out: Segment[] = [];
  let cursor = 0;
  for (const r of sorted) {
    if (r.start < cursor) continue;
    if (r.start > cursor) out.push({ text: text.slice(cursor, r.start), ref: null });
    out.push({ text: text.slice(r.start, r.end), ref: r.ref });
    cursor = r.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), ref: null });
  return out;
}

export interface Correction {
  original: string;
  suggestion: string;
  note?: string;
}

/** Reads AI feedback corrections defensively: stored JSON may be missing fields. */
export function parseCorrections(value: unknown): Correction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((c: unknown) => {
    if (!c || typeof c !== "object") return [];
    const { original, suggestion, note } = c as Record<string, unknown>;
    if (typeof original !== "string" || typeof suggestion !== "string" || !original.trim()) return [];
    return [{ original, suggestion, ...(typeof note === "string" && note ? { note } : {}) }];
  });
}

/** Corrections inside a stored feedback object (`{ corrections: [...] }`), if any. */
export function correctionsFromFeedback(feedback: unknown): Correction[] {
  if (!feedback || typeof feedback !== "object") return [];
  return parseCorrections((feedback as Record<string, unknown>).corrections);
}

function boundary(ch: string): string {
  return /\w/.test(ch) ? "\\b" : "";
}

/**
 * Where each correction's `original` sits in the essay: the first occurrence that does not overlap
 * an earlier correction, ignoring case and differences in whitespace or apostrophes. Corrections
 * the model paraphrased (not found verbatim) are simply not located; the list still shows them.
 */
export function locateCorrections(text: string, corrections: readonly Correction[]): Range[] {
  const found: Range[] = [];
  corrections.forEach((c, ref) => {
    const phrase = c.original.trim();
    if (!phrase) return;
    const re = new RegExp(`${boundary(phrase[0])}${phrasePattern(phrase)}${boundary(phrase[phrase.length - 1])}`, "gi");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (found.some((r) => start < r.end && end > r.start)) continue;
      found.push({ start, end, ref });
      break;
    }
  });
  return found;
}
