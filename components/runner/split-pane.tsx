"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { BookOpen, GripVertical, ListChecks } from "lucide-react";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { clampSplit, parseSplit, splitFromKey, SPLIT_DEFAULT, SPLIT_MAX, SPLIT_MIN } from "@/lib/exam/navigation";

const SPLIT_KEY = "bandup.exam.split";

function readSplit(): number {
  try {
    return parseSplit(window.localStorage.getItem(SPLIT_KEY));
  } catch {
    return SPLIT_DEFAULT;
  }
}

function writeSplit(ratio: number): void {
  try {
    window.localStorage.setItem(SPLIT_KEY, String(Math.round(ratio * 1000) / 1000));
  } catch {
    // Storage blocked: the ratio simply is not remembered.
  }
}

type MobileTab = "passage" | "questions";

interface SplitPaneProps {
  passage: ReactNode;
  questions: ReactNode;
  labels: ExamLabels;
}

/**
 * Passage beside questions. Desktop: a draggable, keyboard-operable divider (remembered per
 * device). Below 1024px: Passage / Questions tabs plus a sticky "View passage" button.
 * Both panes render once; CSS decides which are visible, so inputs keep their state.
 */
export function SplitPane({ passage, questions, labels }: SplitPaneProps) {
  const [ratio, setRatio] = useState(SPLIT_DEFAULT);
  const [tab, setTab] = useState<MobileTab>("questions");
  const grid = useRef<HTMLDivElement>(null);
  const passagePane = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const uid = useId();
  const ids = { tabP: `${uid}-tp`, tabQ: `${uid}-tq`, paneP: `${uid}-pp`, paneQ: `${uid}-pq` };

  // Read the remembered ratio after mount (the server cannot know it).
  useEffect(() => {
    const stored = readSplit();
    if (stored !== SPLIT_DEFAULT) {
      const frame = window.requestAnimationFrame(() => setRatio(stored));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  const update = (next: number) => {
    const r = clampSplit(next);
    setRatio(r);
    writeSplit(r);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current || !grid.current) return;
    const box = grid.current.getBoundingClientRect();
    update((e.clientX - box.left) / box.width);
  };

  const showPassage = () => {
    setTab("passage");
    passagePane.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  };

  const style = { "--split": `${ratio * 100}%` } as CSSProperties;
  const tabClass = (t: MobileTab) =>
    `-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${tab === t ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label={`${labels.passageTab} / ${labels.questionsTab}`} className="flex border-b border-border bg-surface lg:hidden">
        <button type="button" role="tab" id={ids.tabP} aria-controls={ids.paneP} aria-selected={tab === "passage"} className={tabClass("passage")} onClick={() => setTab("passage")}>
          <BookOpen size={15} aria-hidden="true" />
          {labels.passageTab}
        </button>
        <button type="button" role="tab" id={ids.tabQ} aria-controls={ids.paneQ} aria-selected={tab === "questions"} className={tabClass("questions")} onClick={() => setTab("questions")}>
          <ListChecks size={15} aria-hidden="true" />
          {labels.questionsTab}
        </button>
      </div>

      <div ref={grid} style={style} className="grid min-h-0 flex-1 grid-cols-1 lg:h-[calc(100vh-7.5rem)] lg:grid-cols-[var(--split)_0.75rem_1fr]">
        <div
          ref={passagePane}
          id={ids.paneP}
          role="tabpanel"
          aria-labelledby={ids.tabP}
          className={`${tab === "passage" ? "block" : "hidden"} min-w-0 p-4 sm:p-6 lg:block lg:overflow-y-auto`}
        >
          {passage}
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={labels.resizePanes}
          aria-valuemin={Math.round(SPLIT_MIN * 100)}
          aria-valuemax={Math.round(SPLIT_MAX * 100)}
          aria-valuenow={Math.round(ratio * 100)}
          tabIndex={0}
          onKeyDown={(e) => {
            const next = splitFromKey(ratio, e.key);
            if (next === null) return;
            e.preventDefault();
            update(next);
          }}
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => {
            dragging.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          className="group hidden cursor-col-resize touch-none items-center justify-center border-x border-border bg-surface-2 hover:bg-accent-soft focus-visible:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent lg:flex"
        >
          <GripVertical size={14} aria-hidden="true" className="text-muted group-hover:text-accent" />
        </div>

        <div
          id={ids.paneQ}
          role="tabpanel"
          aria-labelledby={ids.tabQ}
          className={`${tab === "questions" ? "block" : "hidden"} relative min-w-0 p-4 sm:p-6 lg:block lg:overflow-y-auto`}
        >
          {questions}
          <div className="sticky bottom-3 mt-6 flex justify-end lg:hidden">
            <button
              type="button"
              onClick={showPassage}
              className="inline-flex h-10 items-center gap-2 rounded border border-border bg-surface px-3 text-sm font-medium shadow-pop hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <BookOpen size={16} aria-hidden="true" />
              {labels.viewPassage}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
