"use client";

import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PhraseGroup } from "@/lib/writing/phrases";
import { fill } from "./format";

interface PhraseBankProps {
  groups: readonly PhraseGroup[];
  onInsert: (phrase: string) => void;
  labels: Dictionary["assist"]["phrases"];
}

/** Phrases grouped by function; a click inserts at the editor's caret. */
export function PhraseBank({ groups, onInsert, labels }: PhraseBankProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted">{labels.hint}</p>
      {groups.map((g) => (
        <section key={g.id} aria-labelledby={`phrases-${g.id}`}>
          <h4 id={`phrases-${g.id}`} className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{labels.groups[g.id]}</h4>
          <ul className="flex flex-wrap gap-1.5">
            {g.phrases.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  // Keep the caret in the textarea: a click would otherwise move focus first.
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onInsert(p)}
                  aria-label={fill(labels.insert, { p })}
                  className="rounded border border-border bg-surface px-2 py-1 text-left font-serif text-sm hover:border-writing hover:bg-writing-soft focus-visible:border-writing"
                >
                  {p}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
