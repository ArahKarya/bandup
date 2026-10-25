"use client";

import { useId } from "react";
import { ClipboardList, ListPlus } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { PLAN_FIELDS, type Plan, type PlanField } from "@/lib/writing/planner";
import type { WritingKind } from "@/lib/writing/task-kind";
import { Button, Input, Select, Textarea } from "@/components/ui";

type PlannerText = Dictionary["assist"]["planner"];

interface WritingPlannerProps {
  kind: WritingKind;
  plan: Plan;
  onChange: (plan: Plan) => void;
  onUseOutline: () => void;
  labels: PlannerText;
}

/** Collapsible planning form; the plan is stored with the draft and can seed an outline. */
export function WritingPlanner({ kind, plan, onChange, onUseOutline, labels }: WritingPlannerProps) {
  const base = useId();
  const set = (id: PlanField["id"], value: string) => onChange({ ...plan, [id]: value });

  return (
    <details className="group rounded border border-border bg-surface">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
        <ClipboardList size={16} className="text-writing" aria-hidden="true" />
        {labels.title}
        <span className="ml-auto text-xs font-normal text-muted">{labels.time}</span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-border px-4 py-4">
        <p className="text-xs text-muted">{labels.hint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLAN_FIELDS[kind].map((field) => (
            <PlanInput key={field.id} id={`${base}-${field.id}`} field={field} value={plan[field.id] ?? ""} onChange={(v) => set(field.id, v)} labels={labels} />
          ))}
        </div>
        <div>
          <Button type="button" size="sm" variant="secondary" onClick={onUseOutline}>
            <ListPlus size={16} aria-hidden="true" />
            {labels.useOutline}
          </Button>
        </div>
      </div>
    </details>
  );
}

interface PlanInputProps {
  id: string;
  field: PlanField;
  value: string;
  onChange: (v: string) => void;
  labels: PlannerText;
}

function optionLabel(field: PlanField, option: string, labels: PlannerText): string {
  if (field.id === "tone") return labels.tones[option as keyof PlannerText["tones"]] ?? option;
  return labels.essayTypes[option as keyof PlannerText["essayTypes"]] ?? option;
}

function PlanInput({ id, field, value, onChange, labels }: PlanInputProps) {
  const label = labels.fields[field.id];
  const placeholder = labels.placeholders[field.id];
  const wide = field.input === "textarea" ? "sm:col-span-2" : "";
  return (
    <div className={`flex flex-col gap-1 ${wide}`}>
      <label htmlFor={id} className="text-xs font-medium">{label}</label>
      {field.input === "select" ? (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>{optionLabel(field, o, labels)}</option>
          ))}
        </Select>
      ) : field.input === "textarea" ? (
        <Textarea id={id} rows={2} value={value} placeholder={placeholder} maxLength={2000} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value} placeholder={placeholder} maxLength={2000} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
