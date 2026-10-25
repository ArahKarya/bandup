/**
 * "Where to find it" text in the content is free-form: "B", "Paragraph C", "Text 1, Annual
 * leave", "Notice, paragraph 4" for reading; "line 7", "lines 13–14", "line 3; line 4" for
 * listening. This turns it into a target the review screen can scroll to.
 */

export type EvidenceTarget = { kind: "paragraph"; label: string } | { kind: "line"; index: number };

const LINE = /^lines?\s+(\d+)/i;
const PARAGRAPH_PREFIX = /^(?:paragraphs?|para\.?)\s+/i;

export function parseEvidence(evidence: string | null | undefined): EvidenceTarget | null {
  const text = (evidence ?? "").trim();
  if (!text) return null;

  const line = LINE.exec(text);
  if (line) {
    const n = Number(line[1]);
    return n >= 1 ? { kind: "line", index: n - 1 } : null;
  }

  const first = text.split(/[,;]/)[0]!.trim().replace(PARAGRAPH_PREFIX, "").trim();
  return first ? { kind: "paragraph", label: first } : null;
}

/**
 * The index of the paragraph an evidence label points at. Labels match case-insensitively
 * ("c" finds "C"); a bare number with no matching label ("paragraph 3" in an unlabelled
 * passage) falls back to the 1-based paragraph position.
 */
export function matchParagraph(labels: readonly (string | null | undefined)[], label: string): number | null {
  const wanted = label.trim().toLowerCase();
  if (!wanted) return null;
  const exact = labels.findIndex((l) => (l ?? "").trim().toLowerCase() === wanted);
  if (exact >= 0) return exact;
  if (/^\d+$/.test(wanted)) {
    const position = Number(wanted) - 1;
    if (position >= 0 && position < labels.length) return position;
  }
  return null;
}
