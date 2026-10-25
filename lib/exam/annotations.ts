import type { Annotation } from "@/lib/attempt/sections";

/**
 * Highlights and notes on passage paragraphs / script lines. Offsets are character
 * positions inside one block's plain text. Everything here is pure; the DOM layer only
 * turns a browser selection into (block, start, end) and draws the segments.
 */

export interface BlockRange {
  block: number;
  start: number;
  end: number;
}

export interface Segment {
  text: string;
  start: number;
  end: number;
  /** Annotations covering the whole segment, highlights before notes. */
  marks: Annotation[];
}

/** Shrinks a range so it does not start or end on whitespace; null when nothing is left. */
export function trimRange(text: string, start: number, end: number): { start: number; end: number } | null {
  let s = Math.max(0, Math.min(start, end));
  let e = Math.min(text.length, Math.max(start, end));
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return e > s ? { start: s, end: e } : null;
}

/**
 * Splits a selection that may span several blocks into one range per block, trimmed of
 * surrounding whitespace. `texts` maps block index to that block's text.
 */
export function splitSelection(
  texts: ReadonlyMap<number, string>,
  from: { block: number; offset: number },
  to: { block: number; offset: number },
): BlockRange[] {
  const [a, b] = from.block < to.block || (from.block === to.block && from.offset <= to.offset) ? [from, to] : [to, from];
  const out: BlockRange[] = [];
  for (let block = a.block; block <= b.block; block++) {
    const text = texts.get(block);
    if (text === undefined) continue;
    const start = block === a.block ? a.offset : 0;
    const end = block === b.block ? b.offset : text.length;
    const r = trimRange(text, start, end);
    if (r) out.push({ block, ...r });
  }
  return out;
}

function overlaps(a: BlockRange, b: BlockRange): boolean {
  return a.block === b.block && a.start < b.end && b.start < a.end;
}

function touches(a: BlockRange, b: BlockRange): boolean {
  return a.block === b.block && a.start <= b.end && b.start <= a.end;
}

const byPosition = (x: Annotation, y: Annotation) => x.block - y.block || x.start - y.start || x.end - y.end;

/** Adds a highlight, merging it with highlights it overlaps or touches. */
export function addHighlight(list: readonly Annotation[], range: BlockRange, id: string): Annotation[] {
  const merged = list.filter((a) => a.kind === "hl" && touches(a, range));
  const start = Math.min(range.start, ...merged.map((a) => a.start));
  const end = Math.max(range.end, ...merged.map((a) => a.end));
  const keepId = merged[0]?.id ?? id;
  const rest = list.filter((a) => !merged.includes(a));
  return [...rest, { id: keepId, block: range.block, start, end, kind: "hl" as const }].sort(byPosition);
}

/** Adds a note over a range; notes never merge, but an identical-range note is replaced. */
export function addNote(list: readonly Annotation[], range: BlockRange, note: string, id: string): Annotation[] {
  const rest = list.filter((a) => !(a.kind === "note" && a.block === range.block && a.start === range.start && a.end === range.end));
  return [...rest, { id, block: range.block, start: range.start, end: range.end, kind: "note" as const, note }].sort(byPosition);
}

/**
 * Clears a range: highlights are cut back (split if the range is in the middle), notes that
 * overlap it are removed. `newId` names the right-hand piece of a split highlight.
 */
export function removeRange(list: readonly Annotation[], range: BlockRange, newId: () => string): Annotation[] {
  const out: Annotation[] = [];
  for (const a of list) {
    if (!overlaps(a, range)) {
      out.push(a);
      continue;
    }
    if (a.kind === "note") continue;
    if (a.start < range.start) out.push({ ...a, end: range.start });
    if (a.end > range.end) out.push({ ...a, id: a.start < range.start ? newId() : a.id, start: range.end });
  }
  return out.sort(byPosition);
}

export function removeAnnotation(list: readonly Annotation[], id: string): Annotation[] {
  return list.filter((a) => a.id !== id);
}

export function updateNote(list: readonly Annotation[], id: string, note: string): Annotation[] {
  return list.map((a) => (a.id === id && a.kind === "note" ? { ...a, note } : a));
}

/** Annotations of one block that overlap a range. */
export function annotationsIn(list: readonly Annotation[], range: BlockRange): Annotation[] {
  return list.filter((a) => overlaps(a, range));
}

/**
 * Cuts a block's text at every annotation boundary so each piece is covered by a fixed set
 * of annotations. Out-of-range offsets (content edited since) are clamped, empty ones dropped.
 */
export function segmentText(text: string, annotations: readonly Annotation[]): Segment[] {
  const valid = annotations
    .map((a) => ({ ...a, start: Math.max(0, Math.min(a.start, text.length)), end: Math.max(0, Math.min(a.end, text.length)) }))
    .filter((a) => a.end > a.start);
  if (valid.length === 0) return text ? [{ text, start: 0, end: text.length, marks: [] }] : [];

  const cuts = [...new Set([0, text.length, ...valid.flatMap((a) => [a.start, a.end])])].sort((x, y) => x - y);
  const segments: Segment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    const marks = valid
      .filter((a) => a.start <= start && a.end >= end)
      .sort((x, y) => (x.kind === y.kind ? x.start - y.start : x.kind === "hl" ? -1 : 1));
    const prev = segments.at(-1);
    // Neighbouring pieces with the same marks are joined so the DOM stays small.
    if (prev && sameMarks(prev.marks, marks)) {
      segments[segments.length - 1] = { ...prev, text: prev.text + text.slice(start, end), end };
    } else {
      segments.push({ text: text.slice(start, end), start, end, marks });
    }
  }
  return segments;
}

function sameMarks(a: readonly Annotation[], b: readonly Annotation[]): boolean {
  return a.length === b.length && a.every((m, i) => m.id === b[i].id);
}

/** Groups a set's annotations by block for quick lookup while rendering. */
export function byBlock(list: readonly Annotation[]): Map<number, Annotation[]> {
  const map = new Map<number, Annotation[]>();
  for (const a of list) map.set(a.block, [...(map.get(a.block) ?? []), a]);
  return map;
}
