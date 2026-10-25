import { Target } from "lucide-react";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";
import { Card, ProgressRing } from "@/components/ui";

/** Minutes studied today against the daily goal from the profile. */
export function DailyGoal({ minutes, goal, t }: { minutes: number; goal: number; t: Dictionary }) {
  const g = t.motivation.goal;
  const safeGoal = Math.max(1, goal);
  const left = Math.max(0, safeGoal - minutes);
  const done = left === 0;
  return (
    <Card className="flex items-center gap-4 p-5" data-testid="daily-goal">
      <ProgressRing value={minutes / safeGoal} size={96} stroke={9} color={done ? "var(--success)" : "var(--accent)"} label={fmt(g.ring, { done: minutes, goal: safeGoal })}>
        <span className="text-xl font-semibold tabular-nums">{minutes}</span>
        <span className="text-[11px] text-muted">/ {safeGoal}</span>
      </ProgressRing>
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-sm font-medium text-muted">
          <Target size={15} aria-hidden="true" />
          {g.title}
        </h2>
        <p className={`mt-1 text-lg font-semibold ${done ? "text-success" : ""}`}>{done ? g.done : fmt(g.toGo, { n: left })}</p>
        <p className="text-xs tabular-nums text-muted">{fmt(g.ofGoal, { done: minutes, goal: safeGoal })}</p>
      </div>
    </Card>
  );
}
