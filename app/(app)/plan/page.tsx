import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, CalendarPlus, Check } from "lucide-react";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getProfile } from "@/lib/server/profile";
import { getLatestBands, studyPlanFor } from "@/lib/server/stats";
import { SKILLS, type PlanWeek } from "@/lib/plan/study-plan";
import { calendarToday, formatDay, isoDay } from "@/lib/stats/dates";
import { phaseOf } from "@/lib/stats/plan-view";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ActivityList } from "@/components/plan/activity-list";
import { Alert, Badge, BandBar, Card, EmptyState, PageHeader, SKILL_META, SkillIcon, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Study plan" };

const totalMinutes = (w: PlanWeek): number => w.days.reduce((s, d) => s + d.activities.reduce((x, a) => x + a.minutes, 0), 0);

export default async function PlanPage() {
  const user = await requireLearner();
  const { t, locale } = await getDictionary();
  const today = calendarToday();

  const [profile, bands, plan] = await Promise.all([getProfile(user.id), getLatestBands(user.id), studyPlanFor(user.id, today)]);
  const todayIso = isoDay(today);
  const isEmpty = plan.weeks.every((w) => w.days.length === 0);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <PageHeader
        title={t.plan.title}
        sub={t.plan.sub}
        icon={<CalendarDays size={20} aria-hidden="true" />}
        actions={
          !isEmpty && (
            // A plain download link: the route returns text/calendar with an attachment disposition.
            <a href="/api/plan/ics" download="bandup-plan.ics" className={buttonClass("secondary")} title={t.motivation.calendar.hint}>
              <CalendarPlus size={16} aria-hidden="true" />
              {t.motivation.calendar.add}
            </a>
          )
        }
      />

      {plan.weeksUntilExam === null && (
        <Alert tone="warning">
          {t.plan.noExam}{" "}
          <Link href="/settings" className="font-medium underline">
            {t.plan.setExam}
          </Link>
        </Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        <Card className="flex flex-col justify-center gap-1 p-5">
          <p className="text-4xl font-semibold tabular-nums text-accent">{plan.weeksUntilExam ?? plan.weeks.length}</p>
          <p className="text-sm text-muted">{plan.weeksUntilExam === null ? t.plan.week : t.plan.weeksLeft}</p>
        </Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {SKILLS.map((s) => (
            <Card key={s} className="flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <SkillIcon skill={s} size="sm" />
                <p className="text-sm font-medium">{t.skill[s]}</p>
              </div>
              <p className="text-xl font-semibold tabular-nums">{bands[s]?.toFixed(1) ?? t.common.none}</p>
              <BandBar band={bands[s] ?? null} target={profile.targetBand} color={SKILL_META[s].cssVar} />
              <p className="flex items-center gap-1 text-xs text-muted">
                {t.plan.gap}:{" "}
                {plan.gaps[s] > 0 ? (
                  <span className="font-medium tabular-nums text-fg">+{plan.gaps[s].toFixed(1)}</span>
                ) : (
                  <Check size={14} className="text-success" aria-label="0" />
                )}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {isEmpty ? (
        <EmptyState illustration="target" title={t.plan.noDays} />
      ) : (
        plan.weeks.map((week) => <WeekCard key={week.index} week={week} todayIso={todayIso} t={t} locale={locale} />)
      )}
    </div>
  );
}

function WeekCard({ week, todayIso, t, locale }: { week: PlanWeek; todayIso: string; t: Dictionary; locale: string }) {
  const current = week.days.some((d) => d.date === todayIso);
  return (
    <section aria-labelledby={`week-${week.index}`}>
      <Card className={`p-4 ${current ? "border-accent" : ""}`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`week-${week.index}`} className="flex flex-wrap items-baseline gap-2 text-lg font-semibold">
            {t.plan.week} {week.index}
            <span className="text-sm font-normal text-muted">{focusText(week.focus, t)}</span>
          </h2>
          <span className="text-sm tabular-nums text-muted">
            {totalMinutes(week)} {t.common.minutes}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {week.days.map((day) => {
            const isToday = day.date === todayIso;
            const past = day.date < todayIso;
            return (
              <div
                key={day.date}
                className={`rounded border p-2 ${isToday ? "border-accent bg-accent-soft" : "border-border bg-surface"} ${past ? "opacity-60" : ""}`}
                aria-current={isToday ? "date" : undefined}
              >
                <div className="flex items-center justify-between px-2 pb-1 pt-1">
                  <p className="text-sm font-medium">
                    {t.days[new Date(`${day.date}T00:00:00Z`).getUTCDay()]}, {formatDay(day.date, locale, false)}
                  </p>
                  {isToday && <Badge tone="accent">{t.plan.today}</Badge>}
                </div>
                <ActivityList activities={day.activities} t={t} compact />
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}

function focusText(focus: string, t: Dictionary): string {
  const phase = phaseOf(focus);
  return phase ? t.plan.phase[phase] : focus;
}
