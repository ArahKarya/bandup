"use client";

import { useActionState, useState } from "react";
import type { AssessState } from "@/app/actions/assess";
import type { CriterionGuide } from "@/lib/scoring/rubric";
import { Alert, Button, Textarea } from "@/components/ui";

const BANDS = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

interface SelfFormProps {
  submissionId: string;
  rubric: CriterionGuide[];
  criteriaLabels: Record<string, string>;
  action: (s: AssessState, f: FormData) => Promise<AssessState>;
  labels: { title: string; save: string; notes: string; saved: string };
}

/** Self-assessment: pick a band per criterion while reading what that band looks like. */
export function SelfAssessForm({ submissionId, rubric, criteriaLabels, action, labels }: SelfFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(rubric.map((c) => [c.key, 6])));

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="submissionId" value={submissionId} />
      <h3 className="font-semibold">{labels.title}</h3>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{labels.saved}</Alert>}
      {rubric.map((c) => {
        const v = values[c.key];
        const nearest = String(Math.min(8, Math.max(5, Math.floor(v)))) as keyof CriterionGuide["bands"];
        return (
          <div key={c.key} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`c-${c.key}`} className="text-sm font-medium">
                {criteriaLabels[c.key]}
              </label>
              <select
                id={`c-${c.key}`}
                name={c.key}
                value={v}
                onChange={(e) => setValues((prev) => ({ ...prev, [c.key]: Number(e.target.value) }))}
                className="h-9 rounded border border-border bg-surface px-2 text-sm tabular-nums"
              >
                {BANDS.map((b) => (
                  <option key={b} value={b}>
                    {b.toFixed(1)}
                  </option>
                ))}
              </select>
            </div>
            <p className="rounded bg-surface-2 px-3 py-2 text-xs text-muted">
              <strong>Band {nearest}:</strong> {c.bands[nearest]}
            </p>
          </div>
        );
      })}
      <Textarea name="notes" rows={3} placeholder={labels.notes} maxLength={2000} />
      <div>
        <Button type="submit" disabled={pending}>
          {labels.save}
        </Button>
      </div>
    </form>
  );
}

interface AiButtonProps {
  submissionId: string;
  action: (s: AssessState, f: FormData) => Promise<AssessState>;
  label: string;
  pendingLabel: string;
}

export function AiAssessButton({ submissionId, action, label, pendingLabel }: AiButtonProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
    </form>
  );
}
