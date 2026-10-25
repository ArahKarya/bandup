import { Check } from "lucide-react";

/** Two-step progress header for onboarding. */
export function OnboardingSteps({ current, labels, stepLabel }: { current: 1 | 2; labels: [string, string]; stepLabel: string }) {
  return (
    <nav aria-label={stepLabel} className="mb-6">
      <p className="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">{stepLabel}</p>
      <ol className="grid grid-cols-2 gap-2">
        {labels.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const active = n === current;
          return (
            <li key={label} aria-current={active ? "step" : undefined} className="flex flex-col gap-2">
              <span className={`h-1 rounded-sm ${done || active ? "bg-accent" : "bg-border"}`} />
              <span className={`flex items-center gap-1.5 text-sm ${active ? "font-semibold" : "text-muted"}`}>
                {done && <Check size={14} className="text-accent" aria-hidden="true" />}
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
