"use client";

import { useState, useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { setMistakeMasteredAction } from "@/app/actions/mistakes";
import { useToast } from "@/components/ui/toast";
import { Badge, Button } from "@/components/ui";
import { streakDots } from "@/lib/mistakes/notebook";

export interface MistakeCardItem {
  id: string;
  setId: string;
  n: number;
  categoryLabel: string;
  given: string;
  expected: string;
  timesWrong: number;
  correctStreak: number;
  mastered: boolean;
  text: string | null;
  explanation: string | null;
  evidence: string | null;
}

export interface MistakeCardLabels {
  question: string;
  selectItem: string;
  yourAnswer: string;
  correctAnswer: string;
  evidence: string;
  timesWrong: string;
  streak: string;
  mastered: string;
  markMastered: string;
  keepPractising: string;
  masteredToast: string;
  unmasteredToast: string;
  error: string;
}

const fill = (template: string, n: number) => template.replace("{n}", String(n));

interface MistakeCardProps {
  item: MistakeCardItem;
  selected: boolean;
  onSelect: () => void;
  labels: MistakeCardLabels;
}

export function MistakeCard({ item, selected, onSelect, labels }: MistakeCardProps) {
  // Optimistic mastered state; the server refresh after the action confirms it.
  const [mastered, setMastered] = useState(item.mastered);
  const [pending, startTransition] = useTransition();
  const { show } = useToast();
  const checkboxId = `mistake-${item.id}`;
  const dots = streakDots(item.correctStreak, mastered);
  const streakText = fill(labels.streak, dots.filter(Boolean).length);

  const setMasteredTo = (next: boolean) => {
    setMastered(next);
    startTransition(async () => {
      try {
        const res = await setMistakeMasteredAction(item.id, next);
        if (!res.ok) throw new Error("update failed");
        show({ tone: "success", title: next ? labels.masteredToast : labels.unmasteredToast });
      } catch {
        setMastered(!next);
        show({ tone: "warning", title: labels.error });
      }
    });
  };

  return (
    <article className={`flex gap-3 rounded border bg-surface p-4 ${selected ? "border-accent" : "border-border"} ${mastered ? "opacity-75" : ""}`}>
      <div className="flex shrink-0 flex-col items-center gap-2 pt-0.5">
        <input
          id={checkboxId}
          type="checkbox"
          checked={selected}
          disabled={mastered}
          onChange={onSelect}
          aria-label={fill(labels.selectItem, item.n)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded border border-danger bg-danger-soft px-1 text-sm font-semibold tabular-nums text-danger">{item.n}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>{item.categoryLabel}</Badge>
          <Badge tone="danger">{fill(labels.timesWrong, item.timesWrong)}</Badge>
          {mastered && (
            <Badge tone="success">
              <Check size={12} className="mr-0.5" aria-hidden="true" />
              {labels.mastered}
            </Badge>
          )}
          <span className="ml-auto inline-flex items-center gap-1" title={streakText}>
            <span className="sr-only">{streakText}</span>
            {dots.map((on, i) => (
              <span key={i} aria-hidden="true" className={`h-2.5 w-2.5 rounded-sm border ${on ? "border-success bg-success" : "border-border bg-surface-2"}`} />
            ))}
          </span>
        </div>

        <label htmlFor={checkboxId} className="cursor-pointer">
          <span className="sr-only">{fill(labels.question, item.n)}: </span>
          {item.text ?? fill(labels.question, item.n)}
        </label>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-muted">{labels.yourAnswer}</dt>
          <dd className="text-danger line-through decoration-1">{item.given || "—"}</dd>
          <dt className="text-muted">{labels.correctAnswer}</dt>
          <dd className="font-semibold text-success">{item.expected}</dd>
        </dl>

        {(item.explanation || item.evidence) && (
          <div className="rounded bg-surface-2 px-3 py-2 text-sm">
            {item.explanation && <p>{item.explanation}</p>}
            {item.evidence && (
              <p className="mt-1 text-xs text-muted">
                {labels.evidence}: {item.evidence}
              </p>
            )}
          </div>
        )}

        <div>
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setMasteredTo(!mastered)}>
            {mastered ? <RotateCcw size={14} aria-hidden="true" /> : <Check size={14} aria-hidden="true" />}
            {mastered ? labels.keepPractising : labels.markMastered}
          </Button>
        </div>
      </div>
    </article>
  );
}
