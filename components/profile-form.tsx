"use client";

import { useActionState } from "react";
import { saveProfileAction, type ActionState } from "@/app/actions/profile";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export interface ProfileValues {
  module: "academic" | "general";
  targetBand: number;
  examDate: string;
  dailyMinutes: number;
  studyDays: number[];
}

interface ProfileFormProps {
  values: ProfileValues;
  labels: {
    module: string;
    academic: string;
    general: string;
    target: string;
    examDate: string;
    dailyMinutes: string;
    studyDays: string;
    days: string[];
    save: string;
    saved: string;
  };
}

const BANDS = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

export function ProfileForm({ values, labels }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProfileAction, {});

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{labels.saved}</Alert>}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium">{labels.module}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(["academic", "general"] as const).map((m) => (
            <label key={m} className="flex cursor-pointer items-center gap-3 rounded border border-border p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="radio" name="module" value={m} defaultChecked={values.module === m} className="accent-[var(--accent)]" />
              <span className="font-medium">{m === "academic" ? labels.academic : labels.general}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={labels.target} htmlFor="targetBand">
          <Select id="targetBand" name="targetBand" defaultValue={String(values.targetBand)}>
            {BANDS.map((b) => (
              <option key={b} value={b}>{b.toFixed(1)}</option>
            ))}
          </Select>
        </Field>
        <Field label={labels.examDate} htmlFor="examDate">
          <Input id="examDate" name="examDate" type="date" defaultValue={values.examDate} />
        </Field>
        <Field label={labels.dailyMinutes} htmlFor="dailyMinutes">
          <Input id="dailyMinutes" name="dailyMinutes" type="number" min={10} max={480} step={5} defaultValue={values.dailyMinutes} />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">{labels.studyDays}</legend>
        <div className="flex flex-wrap gap-2">
          {labels.days.map((d, i) => (
            <label key={d} className="flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="checkbox" name="studyDays" value={i} defaultChecked={values.studyDays.includes(i)} className="accent-[var(--accent)]" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Button type="submit" disabled={pending}>{labels.save}</Button>
      </div>
    </form>
  );
}
