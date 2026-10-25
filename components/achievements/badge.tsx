import {
  BookOpen,
  CircleCheck,
  ClipboardCheck,
  Clock,
  Compass,
  Crown,
  Dumbbell,
  Flame,
  Footprints,
  GraduationCap,
  Lock,
  Star,
  type LucideIcon,
} from "lucide-react";
import type { AchievementIcon, AchievementView } from "@/lib/achievements/rules";
import { formatDay } from "@/lib/stats/dates";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";

/** One achievement tile: coloured with its date once earned, greyed with progress while locked. */

export const ACHIEVEMENT_ICONS: Record<AchievementIcon, LucideIcon> = {
  footprints: Footprints,
  clipboard: ClipboardCheck,
  compass: Compass,
  flame: Flame,
  book: BookOpen,
  graduation: GraduationCap,
  star: Star,
  crown: Crown,
  check: CircleCheck,
  dumbbell: Dumbbell,
  clock: Clock,
};

/** Colour per group, from the existing palette so badges sit in the design system. */
const GROUP_TONE: Record<AchievementView["rule"]["group"], string> = {
  start: "bg-accent-soft text-accent",
  habit: "bg-warning-soft text-warning",
  vocab: "bg-speaking-soft text-speaking",
  lessons: "bg-reading-soft text-reading",
  bands: "bg-success-soft text-success",
  practice: "bg-writing-soft text-writing",
};

export function badgeText(key: string, t: Dictionary): { title: string; body: string } {
  return t.motivation.badges[key as keyof Dictionary["motivation"]["badges"]] ?? { title: key, body: "" };
}

export function progressHint(view: AchievementView, t: Dictionary): string {
  const h = t.motivation.hint;
  const band = view.rule.unit === "band";
  // No score yet reads as "—", not as a best band of 0.0.
  const current = band ? (view.current > 0 ? view.current.toFixed(1) : t.common.none) : view.current;
  const values = { current, goal: view.goal };
  return fmt(h[view.rule.unit], values);
}

interface BadgeProps {
  view: AchievementView;
  t: Dictionary;
  locale: string;
  isNew?: boolean;
  compact?: boolean;
}

export function AchievementBadge({ view, t, locale, isNew = false, compact = false }: BadgeProps) {
  const earned = view.earnedAt !== null;
  const Icon = ACHIEVEMENT_ICONS[view.rule.icon];
  const { title, body } = badgeText(view.rule.key, t);
  const pct = Math.round(view.ratio * 100);

  return (
    <li
      className={`relative flex gap-3 rounded border p-3 ${earned ? "border-border bg-surface shadow-card" : "border-dashed border-border bg-surface-2/50"}`}
      data-achievement={view.rule.key}
      data-earned={earned ? "true" : "false"}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded ${compact ? "h-10 w-10" : "h-12 w-12"} ${earned ? GROUP_TONE[view.rule.group] : "bg-surface-2 text-muted"}`}
        aria-hidden="true"
      >
        <Icon size={compact ? 20 : 24} strokeWidth={2} className={earned ? "" : "opacity-60"} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1.5 font-semibold ${earned ? "" : "text-muted"}`}>
          {title}
          {!earned && <Lock size={13} aria-label={t.motivation.locked} />}
          {isNew && <span className="rounded bg-accent px-1 text-[10px] font-semibold uppercase text-accent-fg">{t.motivation.newBadge}</span>}
        </p>
        {!compact && <p className="text-sm text-muted">{body}</p>}
        {earned && view.earnedAt ? (
          <p className="mt-1 text-xs text-muted">{fmt(t.motivation.earnedOn, { date: formatDay(view.earnedAt, locale) })}</p>
        ) : (
          <div className="mt-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-sm bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={title}>
              <div className="h-full" style={{ width: `${pct}%`, background: "var(--text-muted)" }} />
            </div>
            <p className="mt-1 text-xs tabular-nums text-muted">{progressHint(view, t)}</p>
          </div>
        )}
      </div>
    </li>
  );
}
