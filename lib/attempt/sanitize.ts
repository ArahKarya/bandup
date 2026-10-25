import type { AnswerMap } from "@/lib/scoring/grade";
import type { Annotation } from "./sections";

/**
 * Validation of runner input before it is stored. The client is untrusted: anything
 * malformed is dropped rather than rejected, so one bad field never loses a whole autosave.
 */

export const MAX_ESSAY_CHARS = 20_000;
const MAX_ANSWER_CHARS = 200;

/** Keeps only plausible answers: question-number keys, short strings or short string arrays. */
export function sanitizeAnswers(raw: unknown): AnswerMap {
  if (!raw || typeof raw !== "object") return {};
  const out: AnswerMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{1,3}$/.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, MAX_ANSWER_CHARS);
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string").slice(0, 5).map((x) => x.slice(0, 8));
  }
  return out;
}

const MAX_ANNOTATIONS = 200;

/** Keeps well-formed highlights/notes only; offsets and note length are bounded. */
export function sanitizeAnnotations(raw: unknown): Annotation[] {
  if (!Array.isArray(raw)) return [];
  const out: Annotation[] = [];
  for (const a of raw.slice(0, MAX_ANNOTATIONS)) {
    if (!a || typeof a !== "object") continue;
    const r = a as Record<string, unknown>;
    const ints = [r.block, r.start, r.end].every((v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < 100_000);
    if (!ints || typeof r.id !== "string" || (r.kind !== "hl" && r.kind !== "note")) continue;
    if ((r.end as number) <= (r.start as number)) continue;
    out.push({
      id: r.id.slice(0, 40),
      block: r.block as number,
      start: r.start as number,
      end: r.end as number,
      kind: r.kind,
      ...(r.kind === "note" && typeof r.note === "string" ? { note: r.note.slice(0, 500) } : {}),
    });
  }
  return out;
}

export function sanitizeFlags(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((n): n is number => Number.isInteger(n) && n > 0 && n < 1000))].slice(0, 100);
}
