import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { LinkMatch } from "@/lib/writing/linking";
import { segment } from "@/lib/writing/segments";

interface LinkingPreviewProps {
  text: string;
  matches: readonly LinkMatch[];
  functions: Dictionary["assist"]["analysis"]["functions"];
}

/** Read-only copy of the answer with each linking device marked and labelled by function. */
export function LinkingPreview({ text, matches, functions }: LinkingPreviewProps) {
  const parts = segment(text, matches.map((m, ref) => ({ start: m.start, end: m.end, ref })));
  return (
    <div className="max-h-80 overflow-y-auto whitespace-pre-line rounded border border-border bg-surface-2 p-3 font-serif text-sm leading-relaxed">
      {parts.map((p, i) => {
        if (p.ref === null) return <span key={i}>{p.text}</span>;
        const fn = functions[matches[p.ref].fn];
        return (
          <mark key={i} title={fn} className="rounded-sm bg-writing-soft px-0.5 text-fg underline decoration-writing decoration-2 underline-offset-2">
            {p.text}
            <span className="sr-only"> ({fn})</span>
          </mark>
        );
      })}
    </div>
  );
}
