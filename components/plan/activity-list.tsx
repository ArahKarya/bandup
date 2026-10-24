import Link from "next/link";
import type { PlanActivity } from "@/lib/plan/study-plan";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { activityHref, activityLabel } from "@/lib/stats/plan-view";

/** A day's activities as links; shared by the dashboard and the full plan. */

const KIND_MARK: Record<PlanActivity["kind"], string> = {
  lesson: "bg-[var(--chart-3)]",
  practice: "bg-accent",
  vocab: "bg-[var(--chart-4)]",
  mock: "bg-[var(--chart-2)]",
  review: "bg-[var(--text-muted)]",
};

export function activityText(a: PlanActivity, t: Dictionary): string {
  return activityLabel(a, t.plan.activity, (s) => t.skill[s as keyof typeof t.skill] ?? s);
}

export function ActivityList({ activities, t, compact = false }: { activities: PlanActivity[]; t: Dictionary; compact?: boolean }) {
  return (
    <ul className="flex flex-col gap-1">
      {activities.map((a, i) => (
        <li key={`${a.kind}-${i}`}>
          <Link
            href={activityHref(a)}
            className={`group flex items-center justify-between gap-3 rounded border border-transparent hover:border-border hover:bg-surface-2 ${compact ? "px-2 py-1.5 text-sm" : "px-3 py-2.5"}`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-sm ${KIND_MARK[a.kind]}`} aria-hidden="true" />
              <span className="truncate">{activityText(a, t)}</span>
            </span>
            <span className="shrink-0 text-sm tabular-nums text-muted group-hover:text-fg">
              {a.minutes} {t.common.minutes}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
