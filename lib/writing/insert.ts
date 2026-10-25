/** Inserting a snippet into textarea text at the caret, with sensible spacing either side. */

export interface InsertResult {
  value: string;
  /** Where the caret should go afterwards. */
  caret: number;
}

export function insertAtCursor(value: string, start: number, end: number, snippet: string): InsertResult {
  const from = Math.max(0, Math.min(start, value.length));
  const to = Math.max(from, Math.min(end, value.length));
  const before = value.slice(0, from);
  const after = value.slice(to);
  const lead = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const trail = after.length > 0 && !/^[\s.,;:!?)]/.test(after) ? " " : "";
  const inserted = `${lead}${snippet}${trail}`;
  return { value: `${before}${inserted}${after}`, caret: before.length + lead.length + snippet.length };
}

/** Appends a block (such as an outline) after existing text, separated by a blank line. */
export function appendBlock(value: string, block: string): InsertResult {
  const base = value.replace(/\s+$/, "");
  const next = base ? `${base}\n\n${block}` : block;
  return { value: next, caret: next.length };
}
