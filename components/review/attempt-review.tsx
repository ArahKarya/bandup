import type { Attempt } from "@/generated/prisma/client";
import { parseState, type AttemptResult } from "@/lib/attempt/sections";
import { getContent } from "@/lib/server/content";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/server/db";
import { parseQuestionRef } from "@/lib/mistakes/notebook";
import { skillsWithWrong, wrongAnswered } from "@/lib/mistakes/drill";
import { startPracticeAction } from "@/app/actions/attempts";
import { BandValue, Button, Card, LinkButton, PageHeader } from "@/components/ui";
import { CategoryTable } from "./category-table";
import { MockSummary } from "./mock-summary";
import { SetReview } from "./set-review";
import { DrillProgress, RetryBySkill, RetryWrongButton, SectionCards } from "./review-summary";

async function reviewTitle(attempt: Attempt, t: Awaited<ReturnType<typeof getDictionary>>["t"]): Promise<string> {
  if (attempt.mode === "placement") return t.onboarding.placementTitle;
  if (attempt.mode === "drill") return t.mistakes.drillTitle;
  if (attempt.mode === "mock") return (await getContent("mock_test", attempt.contentId))?.title ?? "Mock test";
  return (await getContent("question_set", attempt.contentId))?.title ?? "Practice";
}

/** Question numbers bookmarked per set, for the sets on this results screen. */
async function bookmarksBySet(userId: string, setIds: string[]): Promise<Map<string, number[]>> {
  if (setIds.length === 0) return new Map();
  const rows = await db.bookmark.findMany({
    where: { userId, kind: "question", OR: setIds.map((id) => ({ refId: { startsWith: `${id}#` } })) },
    select: { refId: true },
    take: 2000,
  });
  const wanted = new Set(setIds);
  const by = new Map<string, number[]>();
  for (const row of rows) {
    const ref = parseQuestionRef(row.refId);
    if (ref && wanted.has(ref.setId)) by.set(ref.setId, [...(by.get(ref.setId) ?? []), ref.n]);
  }
  return by;
}

/** Mastered / total over the questions a drill asked. */
async function drillMastery(attempt: Attempt): Promise<{ mastered: number; total: number }> {
  const drill = parseState(attempt.state).drill;
  const pairs = Object.entries(drill).flatMap(([setId, nums]) => nums.map((n) => ({ setId, n })));
  if (pairs.length === 0) return { mastered: 0, total: 0 };
  const rows = await db.mistakeItem.findMany({
    where: { userId: attempt.userId, setId: { in: Object.keys(drill) } },
    select: { setId: true, n: true, mastered: true },
  });
  const done = new Set(rows.filter((r) => r.mastered).map((r) => `${r.setId}#${r.n}`));
  return { mastered: pairs.filter((p) => done.has(`${p.setId}#${p.n}`)).length, total: pairs.length };
}

export async function AttemptReview({ attempt }: { attempt: Attempt }) {
  const { t } = await getDictionary();
  const result = (attempt.result as unknown as AttemptResult | null) ?? { sections: [] };
  const graded = result.sections.filter((s) => s.sets.length > 0);
  const items = graded.flatMap((s) => s.sets.flatMap((set) => set.items));
  const state = parseState(attempt.state);

  const setIds = graded.flatMap((s) => s.sets.map((set) => set.setId));
  const [title, profile, bookmarks, mastery] = await Promise.all([
    reviewTitle(attempt, t),
    db.profile.findUnique({ where: { userId: attempt.userId } }),
    bookmarksBySet(attempt.userId, setIds),
    attempt.mode === "drill" ? drillMastery(attempt) : Promise.resolve(null),
  ]);
  const target = profile?.targetBand;

  const wrongSkills = skillsWithWrong(result);
  const wrongCounts = wrongSkills.map((skill) => ({ skill, count: wrongAnswered(result, skill).length }));
  const singleRetry = wrongCounts.length === 1 ? wrongCounts[0]! : null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader
        title={`${t.review.title}: ${title}`}
        sub={t.review.estimateNote}
        actions={
          <>
            {singleRetry && <RetryWrongButton attemptId={attempt.id} skill={singleRetry.skill} count={singleRetry.count} label={t.mistakes.retryWrongN} />}
            {attempt.mode === "practice" ? (
              <>
                <form action={startPracticeAction}>
                  <input type="hidden" name="contentId" value={attempt.contentId} />
                  <Button type="submit" variant="secondary">{t.practice.retry}</Button>
                </form>
                <LinkButton href="/practice" variant={singleRetry ? "secondary" : "primary"}>{t.review.back}</LinkButton>
              </>
            ) : attempt.mode === "drill" ? (
              <LinkButton href="/mistakes" variant={singleRetry ? "secondary" : "primary"}>{t.mistakes.backToNotebook}</LinkButton>
            ) : (
              <LinkButton href="/dashboard" variant={singleRetry ? "secondary" : "primary"}>{t.nav.dashboard}</LinkButton>
            )}
          </>
        }
      />

      {mastery && mastery.total > 0 && <DrillProgress mastered={mastery.mastered} total={mastery.total} t={t} />}

      {attempt.mode === "mock" ? (
        <MockSummary attempt={attempt} target={target} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <SectionCards sections={graded} target={target} t={t} />
          {attempt.mode === "placement" && profile?.startingBand != null && (
            <Card className="border-accent p-4">
              <p className="text-sm text-muted">{t.dashboard.estimate}</p>
              <BandValue band={profile.startingBand} target={target} size="lg" />
            </Card>
          )}
        </div>
      )}

      {attempt.mode === "mock" && graded.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SectionCards sections={graded} target={target} t={t} />
        </div>
      )}

      {wrongCounts.length > 1 && <RetryBySkill attemptId={attempt.id} counts={wrongCounts} t={t} />}

      {items.length > 0 && <CategoryTable items={items} title={t.review.byType} />}

      {graded.map((section) => (
        <div key={section.skill} className="flex flex-col gap-6">
          {section.sets.map((setResult) => (
            <SetReview
              key={setResult.setId}
              setId={setResult.setId}
              items={setResult.items}
              answers={stringAnswers(state.answers[setResult.setId])}
              annotations={state.annotations[setResult.setId] ?? []}
              bookmarked={bookmarks.get(setResult.setId) ?? []}
              t={t}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Drops the `undefined` entries an AnswerMap may hold. */
function stringAnswers(answers: Record<string, string | string[] | undefined> | undefined): Record<string, string | string[]> {
  return Object.fromEntries(Object.entries(answers ?? {}).filter((e): e is [string, string | string[]] => e[1] !== undefined));
}
