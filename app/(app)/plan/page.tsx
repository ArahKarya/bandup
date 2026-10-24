import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getProfile } from "@/lib/server/profile";
import { getLatestBands, studyPlanFor } from "@/lib/server/stats";
import { SKILLS, type PlanWeek } from "@/lib/plan/study-plan";
import { calendarToday, formatDay, isoDay } from "@/lib/stats/dates";
import { phaseOf } from "@/lib/stats/plan-view";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ActivityList } from "@/components/plan/activity-list";
import { SectionTitle } from "@/components/dashboard/stat-tile";
import { Alert, Badge, BandValue, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Study plan" };

export default async function PlanPage() {
  const user = await requireLearner();
  const { t, locale } = await getDictionary();
  const today = calendarToday();

  const [profile, bands, plan] = await Promise.all([getProfile(user.id), getLatestBands(user.id), studyPlanFor(user.id, today)]);
  const todayIso = isoDay(today);
  const totalMinutes = (w: PlanWeek) => w.days.reduce((s, d) => s + d.activities.reduce((x, a) => x + a.minutes, 0), 0);
  const isEmpty = plan.weeks.every((w) => w.days.length === 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader title={t.plan.title} sub={t.plan.sub} />

      {plan.weeksUntilExam === null && (
        <Alert tone="warning">
          {t.plan.noExam}{" "}
          <Link href="/settings" className="font-medium underline">
            {t.plan.setExam}
          </Link>
        </Alert>
      )}

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        <Card className="flex flex-col justify-center gap-1 p-4">
          <p className="text-3xl font-semibold tabular-nums">{plan.weeksUntilExam ?? plan.weeks.length}</p>
          <p className="text-sm text-muted">{plan.weeksUntilExam === null ? t.plan.week : t.plan.weeksLeft}</p>
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SKILLS.map((s) => (
            <Card key={s} className="flex flex-col gap-1 p-4">
              <p className="text-sm text-muted">{t.skill[s]}</p>
              <BandValue band={bands[s]} target={profile.targetBand} />
              <p className="text-xs text-muted">
                {t.plan.gap}: {plan.gaps[s] > 0 ? `+${plan.gaps[s].toFixed(1)}` : "✓"}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {isEmpty ? (
        <Alert>{t.plan.noDays}</Alert>
      ) : (
        plan.weeks.map((week) => (
          <section key={week.index} aria-labelledby={`week-${week.index}`}>
            <SectionTitle action={<span className="text-sm tabular-nums text-muted">{totalMinutes(week)} {t.common.minutes}</span>}>
              <span id={`week-${week.index}`}>
                {t.plan.week} {week.index}
                <span className="ml-2 text-sm font-normal text-muted">{focusText(week.focus, t)}</span>
              </span>
            </SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {week.days.map((day) => (
                <Card key={day.date} className={`p-2 ${day.date === todayIso ? "border-accent" : ""}`}>
                  <div className="flex items-center justify-between px-2 pb-1 pt-1">
                    <p className="text-sm font-medium">
                      {t.days[new Date(`${day.date}T00:00:00Z`).getUTCDay()]}, {formatDay(day.date, locale, false)}
                    </p>
                    {day.date === todayIso && <Badge tone="accent">{t.plan.today}</Badge>}
                  </div>
                  <ActivityList activities={day.activities} t={t} compact />
                </Card>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function focusText(focus: string, t: Dictionary): string {
  const phase = phaseOf(focus);
  return phase ? t.plan.phase[phase] : focus;
}
