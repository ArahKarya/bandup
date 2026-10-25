import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getProfile } from "@/lib/server/profile";
import {
  getBandPoints,
  getBandTimeline,
  getCategoryStats,
  getDailyMinutes,
  getLatestBands,
  getRecentAttempts,
  getSpeakingHistory,
  getStudyTime,
  getWeeklyRecap,
  getWritingHistory,
} from "@/lib/server/stats";
import { getAchievementViews } from "@/lib/server/achievements";
import { humanCategory, type Skill } from "@/lib/plan/study-plan";
import { accuracyTone, weakestCategories } from "@/lib/stats/accuracy";
import { addDays, calendarToday, formatDay, startOfUtcWeek } from "@/lib/stats/dates";
import { buildHeatmap } from "@/lib/stats/heatmap";
import { skillTrends } from "@/lib/stats/trends";
import { BandChart } from "@/components/progress/band-chart";
import { AccuracyChart, type AccuracyRow } from "@/components/progress/accuracy-chart";
import { StudyTimeChart } from "@/components/progress/study-time-chart";
import { AttemptTable, SubmissionList } from "@/components/progress/history-tables";
import { ActivityHeatmap } from "@/components/progress/heatmap";
import { WeeklyRecapCard } from "@/components/progress/weekly-recap";
import { TrendSummary } from "@/components/progress/trend-summary";
import { AchievementsPreview } from "@/components/achievements/preview";
import { ChartLine } from "lucide-react";
import { Card, EmptyState, LinkButton, PageHeader, SectionHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Progress" };

const HISTORY_ROWS = 50;

export default async function ProgressPage() {
  const user = await requireLearner();
  const { t, locale } = await getDictionary();
  const today = calendarToday();

  const [profile, timeline, stats, time, attempts, writing, speaking, daily, points, bands, achievements] = await Promise.all([
    getProfile(user.id),
    getBandTimeline(user.id),
    getCategoryStats(user.id, today),
    getStudyTime(user.id, today),
    getRecentAttempts(user.id, HISTORY_ROWS),
    getWritingHistory(user.id),
    getSpeakingHistory(user.id),
    getDailyMinutes(user.id, today),
    getBandPoints(user.id),
    getLatestBands(user.id),
    getAchievementViews(user.id),
  ]);
  const thisWeek = startOfUtcWeek(today);
  const [recapNow, recapLast] = await Promise.all([getWeeklyRecap(user.id, thisWeek, daily), getWeeklyRecap(user.id, addDays(thisWeek, -7), daily)]);

  const hasAnything = timeline.length > 0 || attempts.length > 0 || writing.length > 0 || speaking.length > 0 || time.weekly.some((w) => w.minutes > 0);
  if (!hasAnything) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t.progress.title} sub={t.progress.sub} icon={<ChartLine size={20} aria-hidden="true" />} />
        <EmptyState illustration="chart" title={t.progress.noData} action={<LinkButton href="/practice">{t.nav.practice}</LinkButton>} />
      </div>
    );
  }

  const skillNames: Record<Skill, string> = { listening: t.skill.listening, reading: t.skill.reading, writing: t.skill.writing, speaking: t.skill.speaking };
  const bandRows = timeline.map((r) => ({ ...r, date: formatDay(r.date, locale, false) }));
  const accuracyRows: AccuracyRow[] = weakestCategories(stats, Number.POSITIVE_INFINITY).map((c) => {
    const acc = stats.accuracy[c] ?? 0;
    const count = stats.counts[c] ?? { correct: 0, total: 0 };
    return { label: humanCategory(c), pct: Math.round(acc * 100), correct: count.correct, total: count.total, tone: accuracyTone(acc) };
  });
  const weekRows = time.weekly.map((w) => ({ label: formatDay(w.weekStart, locale, false), minutes: w.minutes }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader title={t.progress.title} sub={t.progress.sub} icon={<ChartLine size={20} aria-hidden="true" />} />

      <TrendSummary bands={bands} trends={skillTrends(points, new Date())} target={profile.targetBand} t={t} />

      <section aria-labelledby="recap-heading">
        <SectionHeading>
          <span id="recap-heading">{t.motivation.recap.title}</span>
        </SectionHeading>
        <div className="grid gap-4 lg:grid-cols-2">
          <WeeklyRecapCard recap={recapNow} title={t.motivation.recap.thisWeek} t={t} locale={locale} />
          <WeeklyRecapCard recap={recapLast} title={t.motivation.recap.lastWeek} t={t} locale={locale} />
        </div>
      </section>

      <section>
        <SectionHeading action={<span className="text-xs text-muted">{t.motivation.heatmap.sub}</span>}>{t.motivation.heatmap.title}</SectionHeading>
        <Card className="p-4">
          <ActivityHeatmap heatmap={buildHeatmap(daily, today, profile.dailyMinutes)} t={t} locale={locale} />
        </Card>
      </section>

      <section>
        <SectionHeading>{t.progress.overTime}</SectionHeading>
        <Card className="p-4">
          {bandRows.length === 0 ? (
            <EmptyState compact illustration="chart" title={t.progress.noBands} />
          ) : (
            <BandChart rows={bandRows} target={profile.targetBand} skillNames={skillNames} targetLabel={t.progress.target} description={t.progress.chartBands} />
          )}
        </Card>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading>{t.progress.byCategory}</SectionHeading>
          <Card className="p-4">
            {accuracyRows.length === 0 ? (
              <EmptyState compact illustration="target" title={t.progress.noCategory} />
            ) : (
              <AccuracyChart rows={accuracyRows} description={t.progress.chartAccuracy} />
            )}
          </Card>
        </section>
        <section>
          <SectionHeading>{t.progress.studyTime}</SectionHeading>
          <Card className="p-4">
            <StudyTimeChart rows={weekRows} minutesLabel={t.progress.minutes} description={t.progress.chartTime} />
          </Card>
        </section>
      </div>

      <AchievementsPreview views={achievements.views} t={t} locale={locale} />

      <section>
        <SectionHeading>{t.progress.history}</SectionHeading>
        <AttemptTable attempts={attempts} t={t} locale={locale} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionHeading>{t.progress.writingHistory}</SectionHeading>
          <SubmissionList items={writing} basePath="/writing" numberLabel={t.progress.task} t={t} locale={locale} />
        </section>
        <section>
          <SectionHeading>{t.progress.speakingHistory}</SectionHeading>
          <SubmissionList items={speaking} basePath="/speaking" numberLabel={t.progress.part} t={t} locale={locale} />
        </section>
      </div>
    </div>
  );
}
