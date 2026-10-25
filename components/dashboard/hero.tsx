import Link from "next/link";
import { CalendarDays, Flame } from "lucide-react";
import { daysUntil } from "@/lib/stats/dates";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";

/** Greeting, exam countdown and streak: the first thing a learner sees. */

interface HeroProps {
  name: string;
  examDate: Date | null;
  today: Date;
  streak: number;
  t: Dictionary;
}

export function DashboardHero({ name, examDate, today, streak, t }: HeroProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{`${t.dashboard.greeting}, ${name}`}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-muted">
          <CalendarDays size={16} aria-hidden="true" />
          <ExamLine examDate={examDate} today={today} t={t} />
        </p>
      </div>
      <StreakFlame streak={streak} t={t} />
    </header>
  );
}

function StreakFlame({ streak, t }: { streak: number; t: Dictionary }) {
  const lit = streak > 0;
  return (
    <div
      className={`flex items-center gap-2 rounded border px-3 py-2 ${lit ? "border-warning bg-warning-soft text-warning" : "border-border bg-surface text-muted"}`}
    >
      <Flame size={22} strokeWidth={2.2} aria-hidden="true" className={lit ? "fill-current" : ""} />
      <span className="text-sm font-semibold tabular-nums">{lit ? fmt(t.motivation.hero.streakDays, { n: streak }) : t.motivation.hero.noStreak}</span>
    </div>
  );
}

function ExamLine({ examDate, today, t }: { examDate: Date | null; today: Date; t: Dictionary }) {
  if (!examDate) {
    return (
      <span>
        {t.dashboard.noExam} ·{" "}
        <Link href="/settings" className="text-accent hover:underline">
          {t.dashboard.setExam}
        </Link>
      </span>
    );
  }
  const days = daysUntil(examDate, today);
  if (days === 0) return <span>{t.dashboard.examToday}</span>;
  if (days < 0) return <span>{t.dashboard.examPassed}</span>;
  return <span className="font-medium text-fg">{fmt(t.motivation.hero.examIn, { n: days })}</span>;
}
