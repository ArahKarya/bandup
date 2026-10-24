import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getProfile } from "@/lib/server/profile";
import { listContent, modulesFor, questionCount, setCategories } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { QUESTION_CATEGORIES, type QuestionCategory } from "@/lib/content/schema";
import { humanCategory } from "@/lib/plan/study-plan";
import { startPracticeAction } from "@/app/actions/attempts";
import { Badge, Button, Card, Empty, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Practice" };

const SKILLS = ["reading", "listening", "writing", "speaking", "grammar"] as const;
type PracticeSkill = (typeof SKILLS)[number];

const isSkill = (v: unknown): v is PracticeSkill => SKILLS.includes(v as PracticeSkill);
const isCategory = (v: unknown): v is QuestionCategory => QUESTION_CATEGORIES.includes(v as QuestionCategory);

export default async function PracticePage({ searchParams }: PageProps<"/practice">) {
  const user = await requireLearner();
  const { t } = await getDictionary();
  const profile = await getProfile(user.id);
  const sp = await searchParams;
  const skill = isSkill(sp.skill) ? sp.skill : null;
  const category = isCategory(sp.category) ? sp.category : null;
  const modules = modulesFor(profile.module);

  const showSets = !skill || skill === "reading" || skill === "listening" || skill === "grammar";
  const sets = showSets
    ? (await listContent("question_set", { module: modules, ...(skill ? { skill } : {}) })).filter(
        (s) => !category || setCategories(s.payload).includes(category),
      )
    : [];
  const writing = !category && (!skill || skill === "writing") ? await listContent("writing_task", { module: modules }) : [];
  const speaking = !category && (!skill || skill === "speaking") ? await listContent("speaking_task") : [];

  const attempts = await db.attempt.findMany({
    where: { userId: user.id, mode: "practice" },
    select: { contentId: true, status: true, rawScore: true, maxScore: true },
  });
  const best = new Map<string, { raw: number; max: number }>();
  const open = new Set<string>();
  for (const a of attempts) {
    if (a.status === "in_progress") open.add(a.contentId);
    if (a.status === "submitted" && a.rawScore !== null && a.maxScore) {
      const prev = best.get(a.contentId);
      if (!prev || a.rawScore / a.maxScore > prev.raw / prev.max) best.set(a.contentId, { raw: a.rawScore, max: a.maxScore });
    }
  }
  const written = new Set((await db.writingSubmission.findMany({ where: { userId: user.id }, select: { taskId: true } })).map((w) => w.taskId));
  const spoken = new Set((await db.speakingSubmission.findMany({ where: { userId: user.id }, select: { taskId: true } })).map((s) => s.taskId));

  const usedCategories = [...new Set((await listContent("question_set", { module: modules })).flatMap((s) => setCategories(s.payload)))].filter(isCategory);

  const href = (next: { skill?: string | null; category?: string | null }) => {
    const q = new URLSearchParams();
    const s = next.skill === undefined ? skill : next.skill;
    const c = next.category === undefined ? category : next.category;
    if (s) q.set("skill", s);
    if (c) q.set("category", c);
    const qs = q.toString();
    return qs ? `/practice?${qs}` : "/practice";
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t.practice.title} sub={t.practice.sub} />

      <div className="mb-6 flex flex-col gap-3">
        <FilterRow label={t.practice.filterSkill}>
          <Chip href={href({ skill: null, category: null })} active={!skill && !category}>{t.practice.all}</Chip>
          {SKILLS.map((s) => (
            <Chip key={s} href={href({ skill: s, category: null })} active={skill === s}>{t.skill[s]}</Chip>
          ))}
        </FilterRow>
        {(!skill || skill === "reading" || skill === "listening") && (
          <FilterRow label={t.practice.filterType}>
            {usedCategories.filter((c) => c !== "grammar").map((c) => (
              <Chip key={c} href={href({ category: category === c ? null : c })} active={category === c}>{humanCategory(c)}</Chip>
            ))}
          </FilterRow>
        )}
      </div>

      {sets.length + writing.length + speaking.length === 0 && <Empty>{t.practice.empty}</Empty>}

      {sets.length > 0 && (
        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((s) => {
            const b = best.get(s.id);
            return (
              <Card key={s.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {t.skill[s.payload.skill]}
                      {s.payload.part ? ` · Part ${s.payload.part}` : ""}
                      {s.module && s.module !== "both" ? ` · ${t.module[s.module as "academic" | "general"]}` : ""}
                    </p>
                    <h3 className="mt-1 font-semibold">{s.title}</h3>
                  </div>
                  {b && <Badge tone={b.raw / b.max >= 0.75 ? "success" : "warning"}>{b.raw}/{b.max}</Badge>}
                </div>
                <div className="flex flex-wrap gap-1">
                  {setCategories(s.payload).map((c) => (
                    <Badge key={c}>{humanCategory(c)}</Badge>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <span className="text-sm text-muted">
                    {questionCount(s.payload)} {t.practice.questions} · {s.payload.minutes} {t.practice.minutes} · {t.practice.difficulty[s.difficulty - 1]}
                  </span>
                  <form action={startPracticeAction}>
                    <input type="hidden" name="contentId" value={s.id} />
                    <Button size="sm" variant={b ? "secondary" : "primary"}>
                      {open.has(s.id) ? t.practice.resume : b ? t.practice.retry : t.practice.start}
                    </Button>
                  </form>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {writing.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">{t.practice.writingTasks}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {writing.map((w) => (
              <TaskCard key={w.id} href={`/practice/writing/${w.id}`} eyebrow={`${t.writing.task} ${w.payload.task} · ${humanCategory(w.payload.taskType)}`} title={w.title} done={written.has(w.id)} cta={t.practice.start} />
            ))}
          </div>
        </section>
      )}

      {speaking.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">{t.practice.speakingTasks}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {speaking.map((s) => (
              <TaskCard key={s.id} href={`/practice/speaking/${s.id}`} eyebrow={`${t.speaking.part} ${s.payload.part}`} title={s.title} done={spoken.has(s.id)} cta={t.practice.start} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 w-24 text-sm text-muted">{label}</span>
      {children}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active} className={`rounded border px-2.5 py-1 text-sm ${active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:text-fg"}`}>
      {children}
    </Link>
  );
}

function TaskCard({ href, eyebrow, title, done, cta }: { href: string; eyebrow: string; title: string; done: boolean; cta: string }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{eyebrow}</p>
          <h3 className="mt-1 font-semibold">{title}</h3>
        </div>
        {done && <Badge tone="success">✓</Badge>}
      </div>
      <div className="mt-auto flex justify-end">
        <LinkButton href={href} size="sm" variant={done ? "secondary" : "primary"}>{cta}</LinkButton>
      </div>
    </Card>
  );
}
