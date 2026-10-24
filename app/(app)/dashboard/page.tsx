import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getProfile } from "@/lib/server/profile";
import {
  estimatedOverall,
  getCategoryStats,
  getLatestBands,
  getRecentAttempts,
  getStudyTime,
  getVocabDueCount,
  hasPlacement,
  studyPlanFor,
} from "@/lib/server/stats";
import { SKILLS, humanCategory } from "@/lib/plan/study-plan";
import { calendarToday, daysUntil, isoDay } from "@/lib/stats/dates";
import { weakestCategories } from "@/lib/stats/accuracy";
import { planDayFor } from "@/lib/stats/plan-view";
import { ActivityList } from "@/components/plan/activity-list";
import { SectionTitle, StatTile } from "@/components/dashboard/stat-tile";
import { RecentList } from "@/components/dashboard/recent-list";
import { BandValue, Card, Empty, LinkButton, ProgressBar } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireLearner();
  const { t, locale } = await getDictionary();
  const today = calendarToday();

  const [profile, bands, stats, time, due, recent, plan] = await Promise.all([
    getProfile(user.id),
    getLatestBands(user.id),
    getCategoryStats(user.id, today),
    getStudyTime(user.id, today),
    getVocabDueCount(user.id, today),
    getRecentAttempts(user.id, 8),
    studyPlanFor(user.id, today),
  ]);
  const placed = await hasPlacement(user.id, profile.startingBand);

  const overall = estimatedOverall(bands);
  const target = profile.targetBand;
  const todayPlan = planDayFor(plan, isoDay(today));
  const weak = weakestCategories(stats, 3);
  const firstName = user.name.split(" ")[0] || user.name;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{`${t.dashboard.greeting}, ${firstName}`}</h1>
        <p className="mt-1 text-muted">
          <ExamLine examDate={profile.examDate} today={today} t={t} />
        </p>
      </header>

      {!placed && (
        <Card className="flex flex-col gap-3 border-accent p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{t.onboarding.placementTitle}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">{t.onboarding.placementBody}</p>
          </div>
          <LinkButton href="/onboarding/placement" className="shrink-0">
            {t.onboarding.takePlacement}
          </LinkButton>
        </Card>
      )}

      <section aria-labelledby="estimate-heading" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="flex flex-col gap-3 p-5">
          <h2 id="estimate-heading" className="text-sm text-muted">
            {t.dashboard.estimate} · {t.skill.overall}
          </h2>
          <div className="flex items-baseline gap-3">
            <BandValue band={overall} target={target} size="lg" />
            <span className="text-sm text-muted">
              {t.dashboard.target} {target.toFixed(1)}
            </span>
          </div>
          {overall === null ? (
            <p className="text-xs text-muted">{t.dashboard.estimateHint}</p>
          ) : (
            <ProgressBar value={overall} max={target} />
          )}
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SKILLS.map((s) => (
            <Card key={s} className="flex flex-col gap-1 p-4">
              <p className="text-sm text-muted">{t.skill[s]}</p>
              <BandValue band={bands[s]} target={target} />
            </Card>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label={t.dashboard.streak} value={time.streak} />
        <StatTile label={t.dashboard.minutesWeek} value={time.minutesThisWeek} />
        <StatTile
          label={t.dashboard.due}
          value={due}
          hint={
            due > 0 ? (
              <Link href="/vocab/review" className="text-accent hover:underline">
                {t.vocab.review}
              </Link>
            ) : undefined
          }
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle action={<Link href="/plan" className="text-sm text-accent hover:underline">{t.dashboard.fullPlan}</Link>}>
            {t.dashboard.today}
          </SectionTitle>
          <Card className="p-2">
            {todayPlan ? <ActivityList activities={todayPlan.activities} t={t} /> : <p className="p-3 text-sm text-muted">{t.dashboard.restDay}</p>}
          </Card>
        </section>

        <section>
          <SectionTitle action={<Link href="/progress" className="text-sm text-accent hover:underline">{t.dashboard.allProgress}</Link>}>
            {t.dashboard.weak}
          </SectionTitle>
          {weak.length === 0 ? (
            <Empty>{t.dashboard.noWeak}</Empty>
          ) : (
            <Card className="divide-y divide-border">
              {weak.map((c) => {
                const acc = stats.accuracy[c] ?? 0;
                const count = stats.counts[c];
                return (
                  <div key={c} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{humanCategory(c)}</p>
                      <p className="text-xs text-muted">
                        {Math.round(acc * 100)}% {t.dashboard.correct}
                        {count ? ` · ${count.correct}/${count.total}` : ""}
                      </p>
                      <ProgressBar value={acc} className="mt-1.5" />
                    </div>
                    <LinkButton href={`/practice?category=${encodeURIComponent(c)}`} variant="secondary" size="sm">
                      {t.dashboard.practiseThis}
                    </LinkButton>
                  </div>
                );
              })}
            </Card>
          )}
        </section>
      </div>

      <section>
        <SectionTitle>{t.dashboard.recent}</SectionTitle>
        {recent.length === 0 ? <Empty>{t.dashboard.nothing}</Empty> : <RecentList attempts={recent} t={t} locale={locale} />}
      </section>
    </div>
  );
}

function ExamLine({ examDate, today, t }: { examDate: Date | null; today: Date; t: Dictionary }) {
  if (!examDate) {
    return (
      <>
        {t.dashboard.noExam} ·{" "}
        <Link href="/settings" className="text-accent hover:underline">
          {t.dashboard.setExam}
        </Link>
      </>
    );
  }
  const days = daysUntil(examDate, today);
  if (days === 0) return <>{t.dashboard.examToday}</>;
  if (days < 0) return <>{t.dashboard.examPassed}</>;
  return (
    <>
      <span className="font-semibold text-fg tabular-nums">{days}</span> {t.dashboard.daysLeft}
    </>
  );
}
