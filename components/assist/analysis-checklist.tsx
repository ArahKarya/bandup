import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Check } from "@/lib/writing/checklist";
import { fill } from "./format";

interface ChecklistProps {
  checks: readonly Check[];
  labels: Dictionary["assist"]["checks"];
  title: string;
}

/** Pass / warn / info rows for the task checklist. */
export function AnalysisChecklist({ checks, labels, title }: ChecklistProps) {
  if (checks.length === 0) return null;
  return (
    <section aria-labelledby="assist-checklist">
      <h4 id="assist-checklist" className="mb-2 text-sm font-semibold">{title}</h4>
      <ul className="flex flex-col gap-1.5 text-sm">
        {checks.map((c) => {
          const Icon = c.pass ? CircleCheck : c.severity === "warn" ? TriangleAlert : Info;
          const tone = c.pass ? "text-success" : c.severity === "warn" ? "text-warning" : "text-muted";
          const message = fill(c.pass ? labels[c.id].pass : labels[c.id].fail, c.params ?? {});
          return (
            <li key={c.id} className="flex items-start gap-2" data-check={c.id} data-pass={c.pass}>
              <Icon size={16} className={`mt-0.5 shrink-0 ${tone}`} aria-hidden="true" />
              <span>{message}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
