import Link from "next/link";
import type { Attempt } from "@/generated/prisma/client";
import type { QuestionSet } from "@/lib/content/schema";
import type { AttemptResult } from "@/lib/attempt/sections";
import type { GradedItem } from "@/lib/scoring/grade";
import { getContent } from "@/lib/server/content";
import { getDictionary } from "@/lib/i18n/server";
import { groupLabels } from "@/lib/i18n/labels";
import { mockBands } from "@/lib/server/mock-bands";
import { db } from "@/lib/server/db";
import { humanCategory } from "@/lib/plan/study-plan";
import { QuestionGroupView } from "@/components/questions/question-group";
import { Passage } from "@/components/runner/passage";
import { Transcript } from "@/components/runner/listening-player";
import { startPracticeAction } from "@/app/actions/attempts";
import { BandValue, Button, Card, LinkButton, PageHeader } from "@/components/ui";

export async function AttemptReview({ attempt }: { attempt: Attempt }) {
  const { t } = await getDictionary();
  const result = (attempt.result as unknown as AttemptResult | null) ?? { sections: [] };
  const graded = result.sections.filter((s) => s.sets.length > 0);
  const items = graded.flatMap((s) => s.sets.flatMap((set) => set.items));

  const title =
    attempt.mode === "placement"
      ? t.onboarding.placementTitle
      : attempt.mode === "mock"
        ? ((await getContent("mock_test", attempt.contentId))?.title ?? "Mock test")
        : ((await getContent("question_set", attempt.contentId))?.title ?? "Practice");

  const profile = await db.profile.findUnique({ where: { userId: attempt.userId } });
  const target = profile?.targetBand;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader
        title={`${t.review.title}: ${title}`}
        sub={t.review.estimateNote}
        actions={
          attempt.mode === "practice" ? (
            <>
              <form action={startPracticeAction}>
                <input type="hidden" name="contentId" value={attempt.contentId} />
                <Button type="submit" variant="secondary">{t.practice.retry}</Button>
              </form>
              <LinkButton href="/practice">{t.review.back}</LinkButton>
            </>
          ) : (
            <LinkButton href="/dashboard">{t.nav.dashboard}</LinkButton>
          )
        }
      />

      {attempt.mode === "mock" ? (
        <MockSummary attempt={attempt} target={target} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {graded.map((s) => (
            <Card key={s.skill} className="p-4">
              <p className="text-sm text-muted">{t.skill[s.skill as keyof typeof t.skill] ?? s.skill}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {s.raw}/{s.max}
              </p>
              {s.skill !== "grammar" && (
                <p className="mt-1 text-sm">
                  {t.review.band}: <BandValue band={s.band} target={target} />
                </p>
              )}
            </Card>
          ))}
          {attempt.mode === "placement" && profile?.startingBand != null && (
            <Card className="border-accent p-4">
              <p className="text-sm text-muted">{t.dashboard.estimate}</p>
              <BandValue band={profile.startingBand} target={target} size="lg" />
            </Card>
          )}
        </div>
      )}

      {items.length > 0 && <CategoryTable items={items} title={t.review.byType} />}

      {graded.map((section) => (
        <div key={section.skill} className="flex flex-col gap-6">
          {section.sets.map((setResult) => (
            <SetReview key={setResult.setId} setId={setResult.setId} items={setResult.items} answers={answersFor(attempt, setResult.setId)} />
          ))}
        </div>
      ))}
    </div>
  );
}

function answersFor(attempt: Attempt, setId: string) {
  const state = attempt.state as { answers?: Record<string, Record<string, string | string[]>> };
  return state.answers?.[setId] ?? {};
}

async function SetReview({ setId, items, answers }: { setId: string; items: GradedItem[]; answers: Record<string, string | string[]> }) {
  const { t } = await getDictionary();
  const set: QuestionSet | null = await getContent("question_set", setId);
  if (!set) return null;
  const results = new Map(items.map((i) => [i.n, i]));
  const raw = items.filter((i) => i.correct).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-semibold">{set.title}</h2>
        <span className="text-sm tabular-nums text-muted">
          {raw}/{items.length}
        </span>
      </div>
      <div className="grid lg:grid-cols-2">
        <details className="border-b border-border p-5 lg:border-r lg:border-b-0" open={Boolean(set.passage)}>
          <summary className="cursor-pointer text-sm font-medium text-accent">{set.passage ? set.passage.title : t.runner.transcript}</summary>
          <div className="mt-4 max-h-[70vh] overflow-y-auto">
            {set.passage && <Passage passage={set.passage} />}
            {set.audio && <Transcript script={set.audio.script} current={null} />}
          </div>
        </details>
        <div className="flex flex-col gap-8 p-5">
          {set.groups.map((g, i) => (
            <QuestionGroupView key={i} group={g} answers={answers} results={results} labels={groupLabels(t)} />
          ))}
        </div>
      </div>
    </Card>
  );
}

function CategoryTable({ items, title }: { items: GradedItem[]; title: string }) {
  const by = new Map<string, { right: number; total: number }>();
  for (const i of items) {
    const row = by.get(i.category) ?? { right: 0, total: 0 };
    by.set(i.category, { right: row.right + (i.correct ? 1 : 0), total: row.total + 1 });
  }
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="flex flex-col gap-2">
        {[...by.entries()]
          .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)
          .map(([cat, { right, total }]) => {
            const pct = right / total;
            return (
              <div key={cat} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[220px_1fr_auto]">
                <span className="text-sm">{humanCategory(cat as GradedItem["category"])}</span>
                <div className="order-3 col-span-2 h-2 rounded-sm bg-surface-2 sm:order-none sm:col-span-1">
                  <div className={`h-full rounded-sm ${pct >= 0.75 ? "bg-success" : pct >= 0.5 ? "bg-warning" : "bg-danger"}`} style={{ width: `${pct * 100}%` }} />
                </div>
                <span className="text-sm tabular-nums text-muted">
                  {right}/{total}
                </span>
              </div>
            );
          })}
      </div>
    </Card>
  );
}

async function MockSummary({ attempt, target }: { attempt: Attempt; target?: number }) {
  const { t } = await getDictionary();
  const bands = await mockBands(attempt.id, attempt.bands);
  const essays = await db.writingSubmission.findMany({ where: { attemptId: attempt.id }, orderBy: { task: "asc" }, include: { scores: { take: 1, orderBy: { createdAt: "desc" } } } });
  const talks = await db.speakingSubmission.findMany({ where: { attemptId: attempt.id }, orderBy: { part: "asc" }, include: { scores: { take: 1, orderBy: { createdAt: "desc" } } } });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["listening", "reading", "writing", "speaking"] as const).map((s) => (
          <Card key={s} className="p-4">
            <p className="text-sm text-muted">{t.skill[s]}</p>
            <BandValue band={bands[s]} target={target} />
          </Card>
        ))}
        <Card className="col-span-2 border-accent p-4 sm:col-span-1">
          <p className="text-sm text-muted">{t.skill.overall}</p>
          <BandValue band={bands.overall} target={target} size="lg" />
        </Card>
      </div>
      {(bands.writing === null || bands.speaking === null) && <p className="text-sm text-warning">{t.mock.pendingWriting}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {essays.map((e) => (
          <Link key={e.id} href={`/writing/${e.id}`} className="flex items-center justify-between rounded border border-border bg-surface p-4 hover:border-accent">
            <span>
              {t.skill.writing} {t.writing.task} {e.task} · {e.wordCount} {t.runner.words}
            </span>
            {e.scores[0] ? <BandValue band={e.scores[0].band} target={target} /> : <span className="text-sm text-accent">{t.writing.assess} →</span>}
          </Link>
        ))}
        {talks.map((s) => (
          <Link key={s.id} href={`/speaking/${s.id}`} className="flex items-center justify-between rounded border border-border bg-surface p-4 hover:border-accent">
            <span>
              {t.skill.speaking} {t.speaking.part} {s.part}
            </span>
            {s.scores[0] ? <BandValue band={s.scores[0].band} target={target} /> : <span className="text-sm text-accent">{t.writing.assess} →</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
