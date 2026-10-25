"use client";

import type { ReactNode } from "react";
import { Play } from "lucide-react";
import type { QuestionSet } from "@/lib/content/schema";
import { scriptLineId } from "./passage";

type Line = NonNullable<QuestionSet["audio"]>["script"][number];

interface TranscriptProps {
  script: readonly Line[];
  current: number | null;
  /** Practice mode: play from a line (the line number button, or a click on the text). */
  onJump?: (i: number) => void;
  /** Set id for the line DOM ids (`scriptLineId`), which evidence links scroll to. */
  setId?: string;
  /** Annotation-aware renderer of a line's text (block = 0-based line index). */
  renderText?: (text: string, index: number) => ReactNode;
  /** "Play from line {n}" with the number filled in. */
  playLabel?: (n: number) => string;
  className?: string;
}

/** The listening script, one numbered line per utterance. */
export function Transcript({ script, current, onJump, setId = "set", renderText, playLabel, className = "max-h-80" }: TranscriptProps) {
  return (
    <ol className={`overflow-y-auto rounded border border-border bg-surface p-3 text-sm ${className}`}>
      {script.map((line, i) => (
        <li key={i} id={scriptLineId(setId, i)} className={`flex scroll-mt-24 gap-2 rounded px-1 py-0.5 ${current === i ? "bg-accent-soft" : ""}`}>
          {onJump ? (
            <button
              type="button"
              onClick={() => onJump(i)}
              aria-label={playLabel ? playLabel(i + 1) : String(i + 1)}
              title={playLabel ? playLabel(i + 1) : undefined}
              className="group inline-flex w-8 shrink-0 items-center justify-end gap-0.5 rounded text-xs tabular-nums text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Play size={10} aria-hidden="true" className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
              {i + 1}
            </button>
          ) : (
            <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
          )}
          <span>
            <strong>{line.speaker}:</strong>{" "}
            <span
              data-block-text={i}
              className={onJump ? "cursor-pointer" : undefined}
              onClick={() => {
                // A plain click plays from the line; a drag selects text for highlighting.
                const sel = window.getSelection();
                if (onJump && (!sel || sel.isCollapsed)) onJump(i);
              }}
            >
              {renderText ? renderText(line.text, i) : line.text}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
