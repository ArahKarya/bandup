import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { listContent } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { Badge, Card, Empty, PageHeader, ProgressBar } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { LessonMeta } from "@/lib/content/schema";

export const metadata: Metadata = { title: "Learn" };

type Skill = LessonMeta["skill"];

/** Orientation first, then the four papers, then the language lessons that lift every band. */
const SKILL_ORDER: readonly Skill[] = ["general", "listening", "reading", "writing", "speaking", "grammar", "vocabulary"];

interface LessonCardData {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  level: LessonMeta["level"];
  done: boolean;
}

export default async function LearnPage() {
  const user = await requireLearner();
  const { t } = await getDictionary();

  const [lessons, progress] = await Promise.all([
    listContent("lesson"),
    db.lessonProgress.findMany({ where: { userId: user.id }, select: { lessonId: true } }),
  ]);
  const done = new Set(progress.map((p) => p.lessonId));

  const groups = SKILL_ORDER.map((skill) => ({
    skill,
    lessons: lessons
      .filter((l) => l.payload.skill === skill)
      .map((l): LessonCardData => ({
        id: l.id,
        title: l.payload.title,
        summary: l.payload.summary,
        minutes: l.payload.minutes,
        level: l.payload.level,
        done: done.has(l.id),
      })),
  })).filter((g) => g.lessons.length > 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.learn.title} sub={t.learn.sub} />
      {groups.length === 0 ? (
        <Empty>{t.learn.empty}</Empty>
      ) : (
        <div className="flex flex-col gap-10">
          {groups.map((g) => (
            <SkillSection key={g.skill} label={t.skill[g.skill]} lessons={g.lessons} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function SkillSection({ label, lessons, t }: { label: string; lessons: LessonCardData[]; t: Dictionary }) {
  const completed = lessons.filter((l) => l.done).length;
  const headingId = `skill-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold">
          {label}
        </h2>
        <span className="text-sm text-muted tabular-nums">
          {completed} {t.common.of} {lessons.length} {t.learn.lessons}
        </span>
      </div>
      <ProgressBar value={completed} max={lessons.length} className="mb-4" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map((l) => (
          <li key={l.id}>
            <LessonCard lesson={l} t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LessonCard({ lesson, t }: { lesson: LessonCardData; t: Dictionary }) {
  return (
    <Link href={`/learn/${lesson.id}`} className="block h-full rounded focus-visible:outline-offset-2">
      <Card className="flex h-full flex-col gap-2 p-4 transition-colors hover:border-accent">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium leading-snug">{lesson.title}</h3>
          {lesson.done && (
            <Badge tone="success" className="shrink-0">
              ✓ <span className="sr-only sm:not-sr-only sm:ml-1">{t.learn.completed}</span>
            </Badge>
          )}
        </div>
        <p className="line-clamp-3 text-sm text-muted">{lesson.summary}</p>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-muted">
          <Badge>{t.learn.levels[lesson.level]}</Badge>
          <span>
            {lesson.minutes} {t.common.minutes}
          </span>
        </div>
      </Card>
    </Link>
  );
}
