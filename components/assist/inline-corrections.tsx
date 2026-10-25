"use client";

import { useId, useState, type KeyboardEvent } from "react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { locateCorrections, segment, type Correction } from "@/lib/writing/segments";
import { fill } from "./format";

interface InlineCorrectionsProps {
  text: string;
  corrections: readonly Correction[];
  labels: Dictionary["assist"]["feedback"];
}

/**
 * The submitted essay with each AI correction marked where it occurs. A mark opens its suggestion
 * on hover, tap or keyboard focus (Enter/Space toggles, Escape closes); screen readers get the
 * suggestion as the mark's description. Corrections not found verbatim stay in the list view.
 */
export function InlineCorrections({ text, corrections, labels }: InlineCorrectionsProps) {
  const base = useId();
  const [open, setOpen] = useState<number | null>(null);
  const ranges = locateCorrections(text, corrections);
  const parts = segment(text, ranges);
  const missing = corrections.length - ranges.length;

  const onKey = (e: KeyboardEvent, ref: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => (o === ref ? null : ref));
    } else if (e.key === "Escape") {
      setOpen(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{labels.title}</h3>
      <p className="text-xs text-muted">{labels.hint}</p>
      <div className="whitespace-pre-line font-serif leading-relaxed" data-testid="inline-corrections">
        {parts.map((p, i) => {
          if (p.ref === null) return <span key={i}>{p.text}</span>;
          const c = corrections[p.ref];
          const ref = p.ref;
          const descId = `${base}-c${ref}`;
          return (
            <span key={i} className="relative" onMouseEnter={() => setOpen(ref)} onMouseLeave={() => setOpen((o) => (o === ref ? null : o))}>
              <mark
                role="button"
                tabIndex={0}
                aria-expanded={open === ref}
                aria-describedby={descId}
                onClick={() => setOpen((o) => (o === ref ? null : ref))}
                onFocus={() => setOpen(ref)}
                onBlur={() => setOpen((o) => (o === ref ? null : o))}
                onKeyDown={(e) => onKey(e, ref)}
                className="cursor-pointer rounded-sm bg-mark px-0.5 text-fg underline decoration-danger decoration-wavy underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-writing"
              >
                {p.text}
              </mark>
              <span id={descId} className="sr-only">
                {labels.suggestion}: {c.suggestion}. {c.note ?? ""}
              </span>
              {open === ref && (
                <span
                  aria-hidden="true"
                  className="absolute top-full left-0 z-30 mt-1 block w-64 max-w-[80vw] rounded border border-border bg-surface p-2.5 font-sans text-sm leading-snug whitespace-normal shadow-pop"
                >
                  <span className="block text-xs font-medium text-muted">{labels.suggestion}</span>
                  <span className="block font-medium text-success">{c.suggestion}</span>
                  {c.note && <span className="mt-1 block text-xs text-muted">{c.note}</span>}
                </span>
              )}
            </span>
          );
        })}
      </div>
      {missing > 0 && <p className="text-xs text-muted">{fill(labels.notFound, { n: missing })}</p>}
    </div>
  );
}
