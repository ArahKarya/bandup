"use client";

import { useActionState, useState } from "react";
import { Briefcase, GraduationCap } from "lucide-react";
import { saveProfileAction, type ActionState } from "@/app/actions/profile";
import { Alert, Button, Field, Input } from "@/components/ui";

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
    academicDesc: string;
    generalDesc: string;
    target: string;
    bandNames: Record<string, string>;
    examDate: string;
    dailyMinutes: string;
    minutesHint: string;
    studyDays: string;
    days: string[];
    save: string;
    saved: string;
  };
}

const BANDS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
const MINUTE_PRESETS = [15, 30, 45, 60, 90];

const MODULES = [
  { id: "academic", icon: GraduationCap },
  { id: "general", icon: Briefcase },
] as const;

/** Radio styled as a square tile; the native input stays for keyboard and form semantics. */
const tile =
  "flex cursor-pointer rounded border border-border bg-surface transition-colors hover:border-fg/30 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent";

export function ProfileForm({ values, labels }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProfileAction, {});
  const [target, setTarget] = useState(values.targetBand);
  const [minutes, setMinutes] = useState(values.dailyMinutes);

  return (
    <form action={action} className="flex flex-col gap-7">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{labels.saved}</Alert>}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{labels.module}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULES.map(({ id, icon: Icon }) => (
            <label key={id} className={`${tile} items-start gap-3 p-4`}>
              <input type="radio" name="module" value={id} defaultChecked={values.module === id} className="sr-only" />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-surface-2 text-accent">
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold">{id === "academic" ? labels.academic : labels.general}</span>
                <span className="mt-0.5 block text-sm text-muted">{id === "academic" ? labels.academicDesc : labels.generalDesc}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-medium">
          <span>{labels.target}</span>
          <span className="text-muted">
            <span className="text-lg font-semibold text-fg tabular-nums">{target.toFixed(1)}</span> · {labels.bandNames[String(Math.floor(target))]}
          </span>
        </legend>
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
          {BANDS.map((b) => (
            <label key={b} className={`${tile} items-center justify-center py-2.5 text-sm font-semibold tabular-nums`}>
              <input type="radio" name="targetBand" value={b} checked={target === b} onChange={() => setTarget(b)} className="sr-only" />
              {b.toFixed(1)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label={labels.examDate} htmlFor="examDate">
          <Input id="examDate" name="examDate" type="date" defaultValue={values.examDate} />
        </Field>
        <Field label={labels.dailyMinutes} htmlFor="dailyMinutes" hint={labels.minutesHint}>
          <div className="flex gap-1.5">
            {MINUTE_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                aria-pressed={minutes === m}
                className={`h-10 flex-1 rounded border text-sm font-medium tabular-nums ${minutes === m ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:text-fg"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <Input id="dailyMinutes" name="dailyMinutes" type="number" min={10} max={480} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="sr-only" />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">{labels.studyDays}</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {labels.days.map((d, i) => (
            <label key={d} className={`${tile} items-center justify-center py-2 text-sm font-medium`}>
              <input type="checkbox" name="studyDays" value={i} defaultChecked={values.studyDays.includes(i)} className="sr-only" />
              {d}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {labels.save}
        </Button>
      </div>
    </form>
  );
}
