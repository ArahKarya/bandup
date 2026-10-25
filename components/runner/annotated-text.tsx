"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import type { Annotation } from "@/lib/attempt/sections";
import { segmentText } from "@/lib/exam/annotations";

export interface MarkHandlers {
  /** A note was activated (click, Enter or Space); `el` positions the editor. */
  onNote?: (a: Annotation, el: HTMLElement) => void;
  /** A highlight was clicked; `el` positions the toolbar. */
  onHighlight?: (a: Annotation, el: HTMLElement) => void;
  editLabel: string;
}

// The note shows on hover and keyboard focus through a CSS pseudo-element, so it adds no
// text nodes and the character offsets of the block stay exact.
const NOTE_TIP =
  "relative after:pointer-events-none after:absolute after:bottom-full after:left-0 after:z-30 after:mb-1 after:hidden after:w-max after:max-w-64 after:whitespace-pre-wrap after:rounded after:bg-fg after:px-2 after:py-1 after:font-sans after:text-xs after:leading-snug after:text-bg after:content-[attr(data-note)] hover:after:block focus-visible:after:block focus-visible:outline-2 focus-visible:outline-accent";

function collapsedSelection(): boolean {
  const sel = window.getSelection();
  return !sel || sel.isCollapsed;
}

/** Draws a block's text with its highlights and notes as `<mark>` elements. */
export function renderAnnotated(text: string, annotations: readonly Annotation[] | undefined, handlers: MarkHandlers): ReactNode {
  if (!annotations || annotations.length === 0) return text;
  return segmentText(text, annotations).map((seg) => {
    const noteMark = seg.marks.find((m) => m.kind === "note");
    const hlMark = seg.marks.find((m) => m.kind === "hl");
    const key = `${seg.start}-${seg.end}`;
    if (noteMark) {
      const activate = (el: HTMLElement) => handlers.onNote?.(noteMark, el);
      return (
        <mark
          key={key}
          className={`hl-note ${NOTE_TIP} ${hlMark ? "shadow-[inset_0_-3px_0_var(--mark)]" : ""}`}
          data-note={noteMark.note ?? ""}
          data-annotation={noteMark.id}
          tabIndex={0}
          role="button"
          aria-label={`${handlers.editLabel}: ${noteMark.note ?? ""}`}
          onClick={(e: MouseEvent<HTMLElement>) => {
            if (!collapsedSelection()) return;
            e.stopPropagation();
            activate(e.currentTarget);
          }}
          onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              activate(e.currentTarget);
            }
          }}
        >
          {seg.text}
        </mark>
      );
    }
    if (hlMark) {
      return (
        <mark
          key={key}
          className="hl"
          data-annotation={hlMark.id}
          onClick={(e: MouseEvent<HTMLElement>) => {
            if (!collapsedSelection() || !handlers.onHighlight) return;
            e.stopPropagation();
            handlers.onHighlight(hlMark, e.currentTarget);
          }}
        >
          {seg.text}
        </mark>
      );
    }
    return <span key={key}>{seg.text}</span>;
  });
}
