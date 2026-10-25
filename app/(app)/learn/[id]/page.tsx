import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getContent, listContent } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { Badge, Card, LinkButton } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { Lesson } from "@/lib/content/schema";
import { LessonActivity, type LessonActivityLabels } from "./lesson-activity";
import { LessonBookmark } from "@/components/mistakes/lesson-bookmark";

export async function generateMetadata({ params }: PageProps<"/learn/[id]">): Promise<Metadata> {
  const { id } = await params;
  const lesson = await getContent("lesson", id);
  return { title: lesson?.title ?? "Lesson" };
}

export default async function LessonPage({ params }: PageProps<"/learn/[id]">) {
  const { id } = await params;
  const user = await requireLearner();
  const { t } = await getDictionary();

  const lesson = await getContent("lesson", id);
  if (!lesson) notFound();

  const [progress, siblings] = await Promise.all([
    db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } } }),
    listContent("lesson", { skill: lesson.skill }),
  ]);
  const position = siblings.findIndex((l) => l.id === lesson.id);
  const next = position >= 0 ? siblings[position + 1] : undefined;
  const lastScore =
    progress?.quizScore != null && progress.quizMax != null ? { score: progress.quizScore, max: progress.quizMax } : null;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/learn" className="text-sm text-muted hover:text-fg">
        ← {t.learn.all}
      </Link>
      <header className="mt-3 mb-6">
        <p className="text-sm text-muted">{t.skill[lesson.skill]}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{lesson.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
          <Badge>{t.learn.levels[lesson.level]}</Badge>
          <span>
            {lesson.minutes} {t.common.minutes}
          </span>
          {progress && <Badge tone="success">✓ {t.learn.completed}</Badge>}
          <LessonBookmark lessonId={lesson.id} />
        </div>
      </header>

      <article className="prose-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{lesson.body}</ReactMarkdown>
      </article>

      <div className="mt-8 flex flex-col gap-8">
        <LessonActivity
          lessonId={lesson.id}
          quiz={lesson.quiz}
          done={Boolean(progress)}
          lastScore={lastScore}
          labels={activityLabels(t)}
        />
        <PracticeLinks lesson={lesson} t={t} />
        <nav aria-label={t.learn.next} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
          {next ? (
            <LinkButton href={`/learn/${next.id}`} variant="secondary">
              {t.learn.next}: {next.title} →
            </LinkButton>
          ) : (
            <p className="text-sm text-muted">{t.learn.lastOfSkill}</p>
          )}
        </nav>
      </div>
    </div>
  );
}

function PracticeLinks({ lesson, t }: { lesson: Lesson; t: Dictionary }) {
  if (lesson.categories.length === 0) return null;
  return (
    <Card className="p-4">
      <h2 className="font-semibold">{t.learn.practice}</h2>
      <p className="mt-1 text-sm text-muted">{t.learn.practiceSub}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {lesson.categories.map((cat) => (
          <li key={cat}>
            <LinkButton href={`/practice?category=${encodeURIComponent(cat)}`} variant="secondary" size="sm">
              {humanize(cat)}
            </LinkButton>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Category ids follow the official task names, so a readable label is just the id spelled out. */
function humanize(category: string): string {
  const words = category.split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function activityLabels(t: Dictionary): LessonActivityLabels {
  return {
    quiz: t.learn.quiz,
    check: t.learn.check,
    retry: t.learn.retry,
    correct: t.learn.correct,
    incorrect: t.learn.incorrect,
    score: t.learn.score,
    answerAll: t.learn.answerAll,
    markDone: t.learn.markDone,
    completed: t.learn.completed,
    saved: t.learn.saved,
    lastDone: t.learn.lastDone,
    error: t.common.error,
  };
}
