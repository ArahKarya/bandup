import Link from "next/link";
import { BookOpen, Dumbbell, Star } from "lucide-react";
import { drillBookmarksAction } from "@/app/actions/mistakes";
import { Button, Card, EmptyState, SkillIcon, isSkillKey } from "@/components/ui";

export interface BookmarkListProps {
  questions: { id: string; setId: string; n: number; setTitle: string; skill: string; text: string }[];
  lessons: { id: string; lessonId: string; title: string; skill: string }[];
  labels: {
    questions: string;
    lessons: string;
    emptyTitle: string;
    emptyBody: string;
    drillAll: string;
    drill: string;
    openLesson: string;
    question: string;
  };
}

/** Starred questions (each drillable) and lessons. */
export function BookmarkList({ questions, lessons, labels }: BookmarkListProps) {
  if (questions.length === 0 && lessons.length === 0) {
    return <EmptyState illustration="notebook" title={labels.emptyTitle} body={labels.emptyBody} />;
  }
  return (
    <div className="flex flex-col gap-8">
      {questions.length > 0 && (
        <section aria-labelledby="bm-questions" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="bm-questions" className="flex items-center gap-2 font-semibold">
              <Star size={16} className="text-warning" aria-hidden="true" />
              {labels.questions}
            </h2>
            <form action={drillBookmarksAction}>
              <Button type="submit" size="sm">
                <Dumbbell size={14} aria-hidden="true" />
                {labels.drillAll}
              </Button>
            </form>
          </div>
          <ul className="flex flex-col gap-2">
            {questions.map((q) => (
              <li key={q.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 gap-3">
                    {isSkillKey(q.skill) && <SkillIcon skill={q.skill} size="sm" />}
                    <div className="min-w-0">
                      <p className="text-xs text-muted">
                        {q.setTitle} · {labels.question.replace("{n}", String(q.n))}
                      </p>
                      <p className="mt-0.5">{q.text}</p>
                    </div>
                  </div>
                  <form action={drillBookmarksAction} className="shrink-0">
                    <input type="hidden" name="bookmarkId" value={q.id} />
                    <Button type="submit" size="sm" variant="secondary" aria-label={`${labels.drill}: ${q.setTitle} ${labels.question.replace("{n}", String(q.n))}`}>
                      {labels.drill}
                    </Button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
      {lessons.length > 0 && (
        <section aria-labelledby="bm-lessons" className="flex flex-col gap-3">
          <h2 id="bm-lessons" className="flex items-center gap-2 font-semibold">
            <BookOpen size={16} className="text-accent" aria-hidden="true" />
            {labels.lessons}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {lessons.map((l) => (
              <li key={l.id}>
                <Link href={`/learn/${l.lessonId}`} className="flex items-center gap-3 rounded border border-border bg-surface p-4 hover:border-accent">
                  {isSkillKey(l.skill) && <SkillIcon skill={l.skill} size="sm" />}
                  <span className="min-w-0 flex-1">{l.title}</span>
                  <span className="text-sm text-accent">{labels.openLesson} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
