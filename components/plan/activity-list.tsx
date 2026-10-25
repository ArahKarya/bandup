import Link from "next/link";
import { BookOpen, ClipboardCheck, GraduationCap, RotateCcw, Dumbbell, type LucideIcon } from "lucide-react";
import type { PlanActivity } from "@/lib/plan/study-plan";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { activityHref, activityLabel } from "@/lib/stats/plan-view";
import { SKILL_META } from "@/components/ui";

/** A day's activities as links; shared by the dashboard and the full plan. */

const KIND_ICON: Record<PlanActivity["kind"], LucideIcon> = {
  lesson: GraduationCap,
  practice: Dumbbell,
  vocab: BookOpen,
  mock: ClipboardCheck,
  review: RotateCcw,
};

export function activityText(a: PlanActivity, t: Dictionary): string {
  return activityLabel(a, t.plan.activity, (s) => t.skill[s as keyof typeof t.skill] ?? s);
}

/** Skill colour and icon when the activity has a skill; the kind's own icon in accent otherwise. */
function ActivityIcon({ a, compact }: { a: PlanActivity; compact: boolean }) {
  const meta = a.skill ? SKILL_META[a.skill] : null;
  const Icon = a.kind === "practice" && meta ? meta.icon : KIND_ICON[a.kind];
  const tone = meta ? `${meta.soft} ${meta.text}` : a.kind === "mock" ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent";
  const box = compact ? "h-6 w-6" : "h-8 w-8";
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded ${box} ${tone}`} aria-hidden="true">
      <Icon size={compact ? 14 : 17} />
    </span>
  );
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
              <ActivityIcon a={a} compact={compact} />
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
