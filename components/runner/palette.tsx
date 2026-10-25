"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import type { PaletteGroup } from "@/lib/exam/navigation";
import { FlagToggle } from "./flag-toggle";

interface PaletteProps {
  groups: PaletteGroup[];
  activeSet: number;
  current: number | null;
  answered: number;
  total: number;
  isAnswered: (setIndex: number, n: number) => boolean;
  isFlagged: (setIndex: number, n: number) => boolean;
  onJump: (n: number) => void;
  onStep: (dir: 1 | -1) => void;
  canStep: { prev: boolean; next: boolean };
  /** Flag control for the question being worked on (covers inline gap-fill blanks too). */
  currentFlagged: boolean;
  onFlagCurrent: () => void;
  labels: ExamLabels & { unanswered: string };
}

/**
 * The bottom question navigator, grouped per part like computer-delivered IELTS: the open
 * part lists its numbers, the others collapse to "Part 2 · 3/10".
 */
export function Palette({ groups, activeSet, current, answered, total, isAnswered, isFlagged, onJump, onStep, canStep, currentFlagged, onFlagCurrent, labels }: PaletteProps) {
  return (
    <nav aria-label={labels.navigator} className="sticky bottom-0 z-20 flex items-center gap-2 border-t border-border bg-surface px-3 py-2 sm:px-6">
      <span className="hidden shrink-0 text-xs tabular-nums text-muted sm:inline">
        {answered}/{total}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto py-1">
        {groups.map((g) => {
          const done = g.numbers.filter((n) => isAnswered(g.setIndex, n)).length;
          if (g.setIndex !== activeSet) {
            return (
              <button
                key={g.setId}
                type="button"
                onClick={() => g.numbers[0] !== undefined && onJump(g.numbers[0])}
                className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded border border-border px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="font-semibold">{g.label}</span>
                <span className="tabular-nums">
                  {done}/{g.numbers.length}
                </span>
              </button>
            );
          }
          return (
            <div key={g.setId} className="flex shrink-0 items-center gap-1.5">
              <span className="text-xs font-semibold">{g.label}</span>
              <ol className="flex gap-1">
                {g.numbers.map((n) => (
                  <li key={n}>
                    <NumberButton n={n} answered={isAnswered(g.setIndex, n)} flagged={isFlagged(g.setIndex, n)} current={current === n} onClick={() => onJump(n)} labels={labels} />
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {current !== null && <FlagToggle n={current} flagged={currentFlagged} onToggle={onFlagCurrent} labels={labels} />}
        <StepButton label={labels.prevQuestion} disabled={!canStep.prev} onClick={() => onStep(-1)}>
          <ChevronLeft size={18} aria-hidden="true" />
        </StepButton>
        <StepButton label={labels.followingQuestion} disabled={!canStep.next} onClick={() => onStep(1)} primary>
          <ChevronRight size={18} aria-hidden="true" />
        </StepButton>
      </div>
    </nav>
  );
}

function NumberButton({ n, answered, flagged, current, onClick, labels }: { n: number; answered: boolean; flagged: boolean; current: boolean; onClick: () => void; labels: PaletteProps["labels"] }) {
  const tone = answered ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-fg";
  const parts = [`${labels.question} ${n}`, answered ? labels.answered : labels.unanswered, ...(flagged ? [labels.flagged] : [])];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={parts.join(", ")}
      aria-current={current ? "step" : undefined}
      data-flagged={flagged || undefined}
      className={`relative h-7 min-w-7 rounded border px-1 text-xs font-medium tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${tone} ${current ? "ring-2 ring-fg/60" : ""} ${flagged ? "border-warning" : ""}`}
    >
      {n}
      {flagged && (
        <Flag size={9} aria-hidden="true" className="absolute -right-1 -top-1 rounded-sm bg-surface fill-warning text-warning" />
      )}
    </button>
  );
}

function StepButton({ label, disabled, onClick, primary = false, children }: { label: string; disabled: boolean; onClick: () => void; primary?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-9 items-center justify-center rounded border focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40 ${primary ? "border-transparent bg-accent text-accent-fg hover:bg-accent-hover" : "border-border bg-surface hover:bg-surface-2"}`}
    >
      {children}
    </button>
  );
}
