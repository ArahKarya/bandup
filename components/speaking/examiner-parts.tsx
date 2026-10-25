"use client";

import { Eye, EyeOff, Mic, Volume2 } from "lucide-react";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { formatClock } from "@/lib/exam/navigation";
import { fill } from "@/lib/exam/text";

/** "The examiner is speaking…" while TTS runs. */
export function ExaminerStatus({ speaking, labels }: { speaking: boolean; labels: ExamLabels }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted" role="status">
      <Volume2 size={16} aria-hidden="true" className={`text-speaking ${speaking ? "motion-safe:animate-pulse" : ""}`} />
      {labels.examinerSpeaking}
    </p>
  );
}

/** The question text: hidden by default like the real test, always shown without a voice. */
export function QuestionText({ text, shown, canToggle, onToggle, labels }: { text: string; shown: boolean; canToggle: boolean; onToggle: () => void; labels: ExamLabels }) {
  return (
    <div className="flex flex-col items-start gap-2">
      {shown && <p className="rounded border border-border bg-surface-2 px-3 py-2 text-base">{text}</p>}
      {canToggle && (
        <button type="button" onClick={onToggle} aria-expanded={shown} className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
          {shown ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          {shown ? labels.hideQuestion : labels.showQuestion}
        </button>
      )}
    </div>
  );
}

/**
 * Elapsed answer time against the indicative length. `hard` (Part 2 long turn) means the
 * recording stops at the target.
 */
export function AnswerTimer({ elapsed, target, hard = false, labels }: { elapsed: number; target: number; hard?: boolean; labels: ExamLabels }) {
  const value = Math.max(0, elapsed);
  const pct = Math.min(100, (value / target) * 100);
  const over = !hard && value > target;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-danger">
          <span className="h-2.5 w-2.5 rounded-sm bg-danger motion-safe:animate-pulse" aria-hidden="true" />
          <Mic size={14} aria-hidden="true" />
          {labels.recording}
        </span>
        <span className="text-xl font-semibold tabular-nums" role="timer">
          {formatClock(value)}
        </span>
        <span className="text-sm text-muted">{hard ? `/ ${formatClock(target)}` : fill(labels.indicative, { sec: target })}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-surface-2" aria-hidden="true">
        <div className={`h-full transition-[width] ${over ? "bg-warning" : "bg-speaking"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
