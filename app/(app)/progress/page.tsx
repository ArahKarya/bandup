import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getProfile } from "@/lib/server/profile";
import {
  getBandTimeline,
  getCategoryStats,
  getRecentAttempts,
  getSpeakingHistory,
  getStudyTime,
  getWritingHistory,
} from "@/lib/server/stats";
import { humanCategory, type Skill } from "@/lib/plan/study-plan";
import { accuracyTone, weakestCategories } from "@/lib/stats/accuracy";
import { calendarToday, formatDay } from "@/lib/stats/dates";
import { BandChart } from "@/components/progress/band-chart";
import { AccuracyChart, type AccuracyRow } from "@/components/progress/accuracy-chart";
import { StudyTimeChart } from "@/components/progress/study-time-chart";
import { AttemptTable, SubmissionList } from "@/components/progress/history-tables";
import { SectionTitle } from "@/components/dashboard/stat-tile";
import { Card, Empty, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Progress" };

const HISTORY_ROWS = 50;

export default async function ProgressPage() {
  const user = await requireLearner();
  const { t, locale } = await getDictionary();
  const today = calendarToday();

  const [profile, timeline, stats, time, attempts, writing, speaking] = await Promise.all([
    getProfile(user.id),
    getBandTimeline(user.id),
    getCategoryStats(user.id, today),
    getStudyTime(user.id, today),
    getRecentAttempts(user.id, HISTORY_ROWS),
    getWritingHistory(user.id),
    getSpeakingHistory(user.id),
  ]);

  const hasAnything = timeline.length > 0 || attempts.length > 0 || writing.length > 0 || speaking.length > 0 || time.weekly.some((w) => w.minutes > 0);
  if (!hasAnything) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t.progress.title} sub={t.progress.sub} />
        <Empty>
          <p>{t.progress.noData}</p>
          <LinkButton href="/practice" className="mt-4">
            {t.nav.practice}
          </LinkButton>
        </Empty>
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
      <PageHeader title={t.progress.title} sub={t.progress.sub} />

      <section>
        <SectionTitle>{t.progress.overTime}</SectionTitle>
        <Card className="p-4">
          {bandRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">{t.progress.noBands}</p>
          ) : (
            <BandChart rows={bandRows} target={profile.targetBand} skillNames={skillNames} targetLabel={t.progress.target} description={t.progress.chartBands} />
          )}
        </Card>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle>{t.progress.byCategory}</SectionTitle>
          <Card className="p-4">
            {accuracyRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">{t.progress.noCategory}</p>
            ) : (
              <AccuracyChart rows={accuracyRows} description={t.progress.chartAccuracy} />
            )}
          </Card>
        </section>
        <section>
          <SectionTitle>{t.progress.studyTime}</SectionTitle>
          <Card className="p-4">
            <StudyTimeChart rows={weekRows} minutesLabel={t.progress.minutes} description={t.progress.chartTime} />
          </Card>
        </section>
      </div>

      <section>
        <SectionTitle>{t.progress.history}</SectionTitle>
        <AttemptTable attempts={attempts} t={t} locale={locale} />
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle>{t.progress.writingHistory}</SectionTitle>
          <SubmissionList items={writing} basePath="/writing" numberLabel={t.progress.task} t={t} locale={locale} />
        </section>
        <section>
          <SectionTitle>{t.progress.speakingHistory}</SectionTitle>
          <SubmissionList items={speaking} basePath="/speaking" numberLabel={t.progress.part} t={t} locale={locale} />
        </section>
      </div>
    </div>
  );
}
