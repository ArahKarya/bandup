import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, CheckCircle2, Clock, Compass, LibraryBig, type LucideIcon } from "lucide-react";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { listContent } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { Badge, EmptyState, LinkButton, PageHeader, ProgressRing, SKILL_META, isSkillKey } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { LessonMeta } from "@/lib/content/schema";

export const metadata: Metadata = { title: "Learn" };

type Skill = LessonMeta["skill"];

/** Orientation first, then the four papers, then the language lessons that lift every band. */
const SKILL_ORDER: readonly Skill[] = ["general", "listening", "reading", "writing", "speaking", "grammar", "vocabulary"];

/** Colour and icon per lesson group; the two non-test groups get neutral ones. */
function groupStyle(skill: Skill): { icon: LucideIcon; text: string; soft: string; bar: string; css: string } {
  if (isSkillKey(skill)) {
    const m = SKILL_META[skill];
    return { icon: m.icon, text: m.text, soft: m.soft, bar: m.bg, css: m.cssVar };
  }
  return skill === "general"
    ? { icon: Compass, text: "text-accent", soft: "bg-accent-soft", bar: "bg-accent", css: "var(--accent)" }
    : { icon: LibraryBig, text: "text-grammar", soft: "bg-grammar-soft", bar: "bg-grammar", css: "var(--grammar)" };
}

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

  // The first unfinished lesson in course order is the natural next step.
  const next = groups.flatMap((g) => g.lessons.map((l) => ({ ...l, skill: g.skill }))).find((l) => !l.done);
  const total = lessons.length;
  const completed = lessons.filter((l) => done.has(l.id)).length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.learn.title} sub={t.learn.sub} icon={<BookOpen size={20} aria-hidden="true" />} />
      {groups.length === 0 ? (
        <EmptyState illustration="books" title={t.learn.empty} />
      ) : (
        <div className="flex flex-col gap-10">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            {next ? (
              <Link
                href={`/learn/${next.id}`}
                className="group flex items-center gap-4 rounded border border-border bg-surface p-5 shadow-card transition-colors hover:border-accent"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded ${groupStyle(next.skill).soft} ${groupStyle(next.skill).text}`}>
                  {(() => {
                    const Icon = groupStyle(next.skill).icon;
                    return <Icon size={22} aria-hidden="true" />;
                  })()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold tracking-wider text-muted uppercase">
                    {t.learn.upNext} · {t.skill[next.skill]}
                  </p>
                  <p className="mt-0.5 truncate font-semibold">{next.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-sm text-muted">{next.summary}</p>
                </div>
                <ArrowRight size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden="true" />
              </Link>
            ) : (
              <EmptyState compact illustration="trophy" title={t.learn.allDone} />
            )}
            <div className="flex items-center gap-4 rounded border border-border bg-surface px-5 py-4 shadow-card">
              <ProgressRing value={total ? completed / total : 0} size={64} stroke={7}>
                <span className="text-sm font-semibold tabular-nums">{total ? Math.round((completed / total) * 100) : 0}%</span>
              </ProgressRing>
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {completed}
                  <span className="text-base font-normal text-muted">/{total}</span>
                </p>
                <p className="text-xs text-muted">{t.learn.lessons}</p>
              </div>
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label={t.learn.title}>
            {groups.map((g) => {
              const style = groupStyle(g.skill);
              const doneCount = g.lessons.filter((l) => l.done).length;
              return (
                <a key={g.skill} href={`#skill-${g.skill}`} className="flex flex-col gap-2 rounded border border-border bg-surface p-3 text-sm hover:border-fg/30">
                  <span className="flex items-center gap-2 font-medium">
                    <style.icon size={15} className={style.text} aria-hidden="true" />
                    <span className="truncate">{t.skill[g.skill]}</span>
                  </span>
                  <span className="h-1 rounded-sm bg-surface-2">
                    <span className="block h-full rounded-sm" style={{ width: `${(doneCount / g.lessons.length) * 100}%`, background: style.css }} />
                  </span>
                  <span className="text-xs text-muted tabular-nums">
                    {doneCount}/{g.lessons.length}
                  </span>
                </a>
              );
            })}
          </nav>

          {groups.map((g) => (
            <SkillSection key={g.skill} skill={g.skill} label={t.skill[g.skill]} lessons={g.lessons} t={t} />
          ))}
          {!next && (
            <div className="flex justify-center">
              <LinkButton href="/practice">{t.nav.practice}</LinkButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SkillSection({ skill, label, lessons, t }: { skill: Skill; label: string; lessons: LessonCardData[]; t: Dictionary }) {
  const completed = lessons.filter((l) => l.done).length;
  const style = groupStyle(skill);
  return (
    <section aria-labelledby={`skill-${skill}`} className="scroll-mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id={`skill-${skill}`} className="flex scroll-mt-6 items-center gap-2.5 text-lg font-semibold">
          <span className={`flex h-8 w-8 items-center justify-center rounded ${style.soft} ${style.text}`}>
            <style.icon size={17} aria-hidden="true" />
          </span>
          {label}
        </h2>
        <span className="text-sm text-muted tabular-nums">
          {completed} {t.common.of} {lessons.length} {t.learn.lessons}
        </span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map((l, i) => (
          <li key={l.id}>
            <LessonCard lesson={l} index={i + 1} barClass={style.bar} t={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LessonCard({ lesson, index, barClass, t }: { lesson: LessonCardData; index: number; barClass: string; t: Dictionary }) {
  return (
    <Link
      href={`/learn/${lesson.id}`}
      className="group relative flex h-full flex-col gap-2 overflow-hidden rounded border border-border bg-surface p-4 pl-5 shadow-card transition-colors hover:border-fg/25"
    >
      <span className={`absolute top-0 bottom-0 left-0 w-1 ${lesson.done ? "bg-success" : barClass} opacity-80`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <h3 className="leading-snug font-medium group-hover:text-accent">
          <span className="mr-1.5 text-muted tabular-nums">{index}.</span>
          {lesson.title}
        </h3>
        {lesson.done && <CheckCircle2 size={18} className="shrink-0 text-success" aria-label={t.learn.completed} />}
      </div>
      <p className="line-clamp-3 text-sm text-muted">{lesson.summary}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1 text-xs text-muted">
        <Badge>{t.learn.levels[lesson.level]}</Badge>
        <span className="inline-flex items-center gap-1">
          <Clock size={12} aria-hidden="true" />
          {lesson.minutes} {t.common.minutes}
        </span>
      </div>
    </Link>
  );
}
