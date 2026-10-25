import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { getProfile } from "@/lib/server/profile";
import { getCategoryStats } from "@/lib/server/stats";
import { listContent, modulesFor, questionCount, setCategories } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { QUESTION_CATEGORIES, type QuestionCategory } from "@/lib/content/schema";
import { humanCategory } from "@/lib/plan/study-plan";
import { Chip, FilterRow, SkillChip } from "@/components/practice/filter-bar";
import { SetCard, TaskCard, type SetCardData } from "@/components/practice/practice-cards";
import { EmptyState, LinkButton, PageHeader, ProgressBar, SectionHeading, SkillIcon } from "@/components/ui";

export const metadata: Metadata = { title: "Practice" };

const SKILLS = ["reading", "listening", "writing", "speaking", "grammar"] as const;
type PracticeSkill = (typeof SKILLS)[number];
const STATUSES = ["todo", "done"] as const;
const SORTS = ["recommended", "easy", "hard"] as const;

const isSkill = (v: unknown): v is PracticeSkill => SKILLS.includes(v as PracticeSkill);
const isCategory = (v: unknown): v is QuestionCategory => QUESTION_CATEGORIES.includes(v as QuestionCategory);
const pick = <T extends string>(v: unknown, options: readonly T[]): T | null => (options.includes(v as T) ? (v as T) : null);

/** Below this accuracy a question type is flagged as a weak spot on the cards. */
const WEAK_ACCURACY = 0.6;

export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  const user = await requireLearner();
  const { t } = await getDictionary();
  const profile = await getProfile(user.id);
  const sp = await searchParams;
  const skill = isSkill(sp.skill) ? sp.skill : null;
  const category = isCategory(sp.category) ? sp.category : null;
  const status = pick(sp.status, STATUSES);
  const sort = pick(sp.sort, SORTS) ?? "recommended";
  const modules = modulesFor(profile.module);

  const [allSets, writing, speaking, attempts, essays, talks, categoryStats] = await Promise.all([
    listContent("question_set", { module: modules }),
    listContent("writing_task", { module: modules }),
    listContent("speaking_task"),
    db.attempt.findMany({ where: { userId: user.id, mode: "practice" }, select: { contentId: true, status: true, rawScore: true, maxScore: true } }),
    db.writingSubmission.findMany({ where: { userId: user.id }, select: { taskId: true } }),
    db.speakingSubmission.findMany({ where: { userId: user.id }, select: { taskId: true } }),
    getCategoryStats(user.id),
  ]);

  const best = new Map<string, { raw: number; max: number }>();
  const open = new Set<string>();
  for (const a of attempts) {
    if (a.status === "in_progress") open.add(a.contentId);
    if (a.status === "submitted" && a.rawScore !== null && a.maxScore) {
      const prev = best.get(a.contentId);
      if (!prev || a.rawScore / a.maxScore > prev.raw / prev.max) best.set(a.contentId, { raw: a.rawScore, max: a.maxScore });
    }
  }
  const written = new Set(essays.map((w) => w.taskId));
  const spoken = new Set(talks.map((s) => s.taskId));
  const weak = new Set(
    (Object.entries(categoryStats.accuracy) as [QuestionCategory, number][]).filter(([, acc]) => acc < WEAK_ACCURACY).map(([c]) => c),
  );

  const usedCategories = [...new Set(allSets.flatMap((s) => setCategories(s.payload)))].filter(isCategory).filter((c) => c !== "grammar");
  const skillCount = (s: PracticeSkill) =>
    s === "writing" ? writing.length : s === "speaking" ? speaking.length : allSets.filter((x) => x.skill === s).length;

  const showSets = !skill || skill === "reading" || skill === "listening" || skill === "grammar";
  const sets = showSets
    ? allSets
        .filter((s) => !skill || s.skill === skill)
        .filter((s) => !category || setCategories(s.payload).includes(category))
        .filter((s) => (status === "todo" ? !best.has(s.id) : status === "done" ? best.has(s.id) : true))
    : [];

  // Recommended: unfinished first, then sets that train a weak type, then easier ones.
  const score = (s: (typeof sets)[number]) =>
    (best.has(s.id) ? 100 : 0) - (setCategories(s.payload).some((c) => weak.has(c as QuestionCategory)) ? 10 : 0) + s.difficulty;
  const sorted = [...sets].sort((a, b) =>
    sort === "easy" ? a.difficulty - b.difficulty : sort === "hard" ? b.difficulty - a.difficulty : score(a) - score(b),
  );

  const showTasks = !category;
  const writingShown = showTasks && (!skill || skill === "writing") ? writing.filter((w) => (status === "todo" ? !written.has(w.id) : status === "done" ? written.has(w.id) : true)) : [];
  const speakingShown = showTasks && (!skill || skill === "speaking") ? speaking.filter((s) => (status === "todo" ? !spoken.has(s.id) : status === "done" ? spoken.has(s.id) : true)) : [];

  const total = allSets.length + writing.length + speaking.length;
  const completed = allSets.filter((s) => best.has(s.id)).length + writing.filter((w) => written.has(w.id)).length + speaking.filter((s) => spoken.has(s.id)).length;

  const href = (next: Partial<Record<"skill" | "category" | "status" | "sort", string | null>>) => {
    const current = { skill, category, status, sort: sort === "recommended" ? null : sort };
    const merged = { ...current, ...next };
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) q.set(k, v);
    const qs = q.toString();
    return qs ? `/practice?${qs}` : "/practice";
  };

  const cardLabels = { start: t.practice.start, resume: t.practice.resume, retry: t.practice.retry, best: t.practice.best, inProgress: t.practice.inProgress, weakHint: t.practice.weakHint };
  const filtered = Boolean(skill || category || status);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={t.practice.title}
        sub={t.practice.sub}
        icon={<ClipboardCheck size={20} aria-hidden="true" />}
        actions={
          <div className="w-56">
            <p className="mb-1 text-right text-xs text-muted">{fmt(t.practice.completedOf, { done: completed, total })}</p>
            <ProgressBar value={completed} max={total} />
          </div>
        }
      />

      <div className="mb-8 flex flex-col gap-3 rounded border border-border bg-surface p-4 shadow-card">
        <FilterRow label={t.practice.filterSkill}>
          <Chip href={href({ skill: null, category: null })} active={!skill} count={total}>
            {t.practice.all}
          </Chip>
          {SKILLS.map((s) => (
            <SkillChip key={s} skill={s} href={href({ skill: s, category: null })} active={skill === s} label={t.skill[s]} count={skillCount(s)} />
          ))}
        </FilterRow>
        {(!skill || skill === "reading" || skill === "listening") && (
          <FilterRow label={t.practice.filterType}>
            {usedCategories.map((c) => (
              <Chip key={c} href={href({ category: category === c ? null : c })} active={category === c}>
                {weak.has(c) && <span className="h-1.5 w-1.5 rounded-sm bg-warning" aria-label={t.practice.weakHint} />}
                {humanCategory(c)}
              </Chip>
            ))}
          </FilterRow>
        )}
        <div className="flex flex-col gap-3 lg:flex-row lg:gap-8">
          <FilterRow label={t.practice.status}>
            <Chip href={href({ status: null })} active={!status}>
              {t.practice.statusAll}
            </Chip>
            <Chip href={href({ status: "todo" })} active={status === "todo"}>
              {t.practice.statusTodo}
            </Chip>
            <Chip href={href({ status: "done" })} active={status === "done"}>
              {t.practice.statusDone}
            </Chip>
          </FilterRow>
          <FilterRow label={t.practice.sort}>
            <Chip href={href({ sort: null })} active={sort === "recommended"}>
              {t.practice.sortRecommended}
            </Chip>
            <Chip href={href({ sort: "easy" })} active={sort === "easy"}>
              {t.practice.sortEasy}
            </Chip>
            <Chip href={href({ sort: "hard" })} active={sort === "hard"}>
              {t.practice.sortHard}
            </Chip>
          </FilterRow>
        </div>
      </div>

      {sorted.length + writingShown.length + speakingShown.length === 0 && (
        <EmptyState
          illustration="books"
          title={t.practice.empty}
          action={
            filtered ? (
              <LinkButton href="/practice" variant="secondary" size="sm">
                {t.practice.clear}
              </LinkButton>
            ) : undefined
          }
        />
      )}

      {sorted.length > 0 && (
        <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((s) => {
            const cats = setCategories(s.payload);
            const data: SetCardData = {
              id: s.id,
              skill: s.payload.skill,
              title: s.title,
              eyebrow: [t.skill[s.payload.skill], s.payload.part ? `Part ${s.payload.part}` : null, s.module && s.module !== "both" ? t.module[s.module as "academic" | "general"] : null]
                .filter(Boolean)
                .join(" · "),
              categories: cats.map((c) => humanCategory(c)),
              meta: `${questionCount(s.payload)} ${t.practice.questions} · ${s.payload.minutes} ${t.practice.minutes}`,
              best: best.get(s.id) ?? null,
              inProgress: open.has(s.id),
              weak: cats.some((c) => weak.has(c as QuestionCategory)),
            };
            return <SetCard key={s.id} data={data} difficulty={s.difficulty} difficultyLabel={t.practice.difficulty[s.difficulty - 1]} labels={cardLabels} />;
          })}
        </div>
      )}

      {writingShown.length > 0 && (
        <section className="mb-12">
          <SectionHeading icon={<SkillIcon skill="writing" size="sm" />}>{t.practice.writingTasks}</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {writingShown.map((w) => (
              <TaskCard
                key={w.id}
                skill="writing"
                href={`/practice/writing/${w.id}`}
                eyebrow={`${t.writing.task} ${w.payload.task} · ${humanCategory(w.payload.taskType)}`}
                title={w.title}
                done={written.has(w.id)}
                cta={t.practice.start}
              >
                <p className="line-clamp-2 text-sm text-muted">{w.payload.prompt.split("\n")[0]}</p>
              </TaskCard>
            ))}
          </div>
        </section>
      )}

      {speakingShown.length > 0 && (
        <section>
          <SectionHeading icon={<SkillIcon skill="speaking" size="sm" />}>{t.practice.speakingTasks}</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {speakingShown.map((s) => (
              <TaskCard key={s.id} skill="speaking" href={`/practice/speaking/${s.id}`} eyebrow={`${t.speaking.part} ${s.payload.part}`} title={s.title} done={spoken.has(s.id)} cta={t.practice.start}>
                <p className="line-clamp-2 text-sm text-muted">{s.payload.cueCard?.prompt ?? s.payload.questions[0]}</p>
              </TaskCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
