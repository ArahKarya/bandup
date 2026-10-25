import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, CalendarDays, Clock, History, Target } from "lucide-react";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getProfile } from "@/lib/server/profile";
import { modulesFor } from "@/lib/server/content";
import {
  estimatedOverall,
  getBandPoints,
  getCategoryStats,
  getDailyMinutes,
  getLatestBands,
  getNextStepFacts,
  getRecentAttempts,
  getStudyTime,
  getVocabDueCount,
  getWeeklyRecap,
  hasPlacement,
  studyPlanFor,
} from "@/lib/server/stats";
import { recommendNext } from "@/lib/plan/recommend";
import { SKILLS, type Skill } from "@/lib/plan/study-plan";
import { addDays, calendarToday, isoDay, startOfUtcWeek } from "@/lib/stats/dates";
import { weakestCategories } from "@/lib/stats/accuracy";
import { planDayFor } from "@/lib/stats/plan-view";
import { buildHeatmap, minutesOn } from "@/lib/stats/heatmap";
import { isRecapDay } from "@/lib/stats/recap";
import { daysSince, skillTrends } from "@/lib/stats/trends";
import { ActivityList } from "@/components/plan/activity-list";
import { RecentList } from "@/components/dashboard/recent-list";
import { DashboardHero } from "@/components/dashboard/hero";
import { BandOverview } from "@/components/dashboard/band-overview";
import { DailyGoal } from "@/components/dashboard/daily-goal";
import { NextStepCard } from "@/components/dashboard/next-step";
import { FocusAreas } from "@/components/dashboard/focus-areas";
import { ActivityHeatmap } from "@/components/progress/heatmap";
import { WeeklyRecapCard } from "@/components/progress/weekly-recap";
import { Card, EmptyState, LinkButton, SectionHeading, Stat } from "@/components/ui";

export const metadata: Metadata = { title: "Dashboard" };

const linkClass = "text-sm text-accent hover:underline";

export default async function DashboardPage() {
  const user = await requireLearner();
  const { t, locale } = await getDictionary();
  const today = calendarToday();
  const now = new Date();

  const profileP = getProfile(user.id);
  const [profile, bands, stats, time, due, recent, plan, daily, points, facts] = await Promise.all([
    profileP,
    getLatestBands(user.id),
    getCategoryStats(user.id, today),
    getStudyTime(user.id, today),
    getVocabDueCount(user.id, now),
    getRecentAttempts(user.id, 6),
    studyPlanFor(user.id, today),
    getDailyMinutes(user.id, today),
    getBandPoints(user.id),
    profileP.then((p) => getNextStepFacts(user.id, modulesFor(p.module), now)),
  ]);
  const [placed, recap] = await Promise.all([
    hasPlacement(user.id, profile.startingBand),
    isRecapDay(today) ? getWeeklyRecap(user.id, addDays(startOfUtcWeek(today), -7), daily) : Promise.resolve(null),
  ]);

  const target = profile.targetBand;
  const todayPlan = planDayFor(plan, isoDay(today));
  const weak = weakestCategories(stats, 3);
  const minutesToday = minutesOn(daily, today);
  const weakSkill = weak[0] ? facts.categorySkills.get(weak[0]) : undefined;

  const step = recommendNext({
    openAttempt: facts.openAttempt,
    vocabDue: due,
    todayPlan: todayPlan?.activities ?? [],
    goalMet: minutesToday >= profile.dailyMinutes,
    openMistakes: facts.openMistakes,
    weakCategory: weak[0] ?? null,
    weakCategorySkill: SKILLS.find((s): s is Skill => s === weakSkill) ?? null,
    daysSinceMock: daysSince(facts.lastMockAt, today),
    submittedSets: facts.submittedSets,
    nextLesson: facts.nextLesson,
    bands,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <DashboardHero name={user.name.split(" ")[0] || user.name} examDate={profile.examDate} today={today} streak={time.streak} t={t} />

      {!placed && (
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{t.onboarding.placementTitle}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">{t.onboarding.placementBody}</p>
          </div>
          <LinkButton href="/onboarding/placement" variant="secondary" className="shrink-0">
            {t.onboarding.takePlacement}
          </LinkButton>
        </Card>
      )}

      <NextStepCard step={step} t={t} />

      <section aria-label={t.dashboard.estimate} className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <BandOverview overall={estimatedOverall(bands)} target={target} bands={bands} trends={skillTrends(points, now)} t={t} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <DailyGoal minutes={minutesToday} goal={profile.dailyMinutes} t={t} />
          <div className="grid grid-cols-2 gap-4">
            <Stat label={t.dashboard.minutesWeek} value={time.minutesThisWeek} icon={<Clock size={16} className="text-muted" aria-hidden="true" />} />
            <Stat
              label={t.dashboard.due}
              value={due}
              icon={<BookOpen size={16} className="text-muted" aria-hidden="true" />}
              hint={
                due > 0 ? (
                  <Link href="/vocab/review" className="text-accent hover:underline">
                    {t.vocab.review}
                  </Link>
                ) : undefined
              }
            />
          </div>
        </div>
      </section>

      {recap && <WeeklyRecapCard recap={recap} title={`${t.motivation.recap.title} · ${t.motivation.recap.lastWeek}`} t={t} locale={locale} />}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading icon={<CalendarDays size={18} className="text-accent" aria-hidden="true" />} action={<Link href="/plan" className={linkClass}>{t.dashboard.fullPlan}</Link>}>
            {t.dashboard.today}
          </SectionHeading>
          <Card className="p-2">
            {todayPlan ? <ActivityList activities={todayPlan.activities} t={t} /> : <p className="p-3 text-sm text-muted">{t.dashboard.restDay}</p>}
          </Card>
        </section>
        <section>
          <SectionHeading icon={<Target size={18} className="text-accent" aria-hidden="true" />} action={<Link href="/progress" className={linkClass}>{t.dashboard.allProgress}</Link>}>
            {t.dashboard.weak}
          </SectionHeading>
          <FocusAreas categories={weak} stats={stats} categorySkills={facts.categorySkills} t={t} />
        </section>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section>
          <SectionHeading action={<span className="text-xs text-muted">{t.motivation.heatmap.sub}</span>}>{t.motivation.heatmap.title}</SectionHeading>
          <Card className="p-4">
            <ActivityHeatmap heatmap={buildHeatmap(daily, today, profile.dailyMinutes)} t={t} locale={locale} size="compact" />
          </Card>
        </section>
        <section>
          <SectionHeading icon={<History size={18} className="text-accent" aria-hidden="true" />}>{t.dashboard.recent}</SectionHeading>
          {recent.length === 0 ? (
            <EmptyState compact illustration="chart" title={t.dashboard.nothing} action={<LinkButton href="/practice" size="sm">{t.nav.practice}</LinkButton>} />
          ) : (
            <RecentList attempts={recent} t={t} locale={locale} />
          )}
        </section>
      </div>
    </div>
  );
}
