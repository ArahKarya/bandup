import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getContent } from "@/lib/server/content";
import { getProfile } from "@/lib/server/profile";
import { db } from "@/lib/server/db";
import { WRITING_RUBRIC } from "@/lib/scoring/rubric";
import { aiScoreWritingAction, selfScoreWritingAction } from "@/app/actions/assess";
import { WritingPrompt } from "@/components/runner/writing-prompt";
import { AiAssessButton, SelfAssessForm } from "@/components/assess/assessment-forms";
import { ScorePanel } from "@/components/assess/score-panel";
import { SampleAnswers } from "@/components/assess/sample-answers";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Writing feedback" };

export default async function WritingSubmissionPage({ params }: PageProps<"/writing/[id]">) {
  const user = await requireLearner();
  const { id } = await params;
  const { t, locale } = await getDictionary();

  const sub = await db.writingSubmission.findFirst({
    where: { id, userId: user.id },
    include: { scores: { orderBy: { createdAt: "desc" } } },
  });
  if (!sub) notFound();
  const task = await getContent("writing_task", sub.taskId);
  if (!task) notFound();
  const profile = await getProfile(user.id);
  const hasKey = Boolean(await db.apiCredential.findUnique({ where: { userId: user.id }, select: { userId: true } }));

  const criteriaLabels: Record<string, string> = t.writing.criteria;
  const panelLabels = { strengths: t.writing.strengths, improvements: t.writing.improvements, corrections: t.writing.corrections, ai: "AI", self: t.writing.selfAssess };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${t.writing.task} ${task.task}: ${task.title}`}
        actions={
          <>
            {sub.attemptId && <LinkButton href={`/attempt/${sub.attemptId}`} variant="secondary">{t.review.title}</LinkButton>}
            <LinkButton href={`/practice/writing/${task.id}`} variant="secondary">{t.practice.retry}</LinkButton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <WritingPrompt task={task} />
          <Card className="p-5">
            <p className="mb-2 text-sm text-muted">
              {sub.wordCount} {t.runner.words}
              {sub.wordCount < task.minWords && <span className="text-warning"> · {t.writing.tooShort}</span>}
            </p>
            <div className="whitespace-pre-line font-serif leading-relaxed">{sub.text || "—"}</div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {sub.scores.map((s) => (
            <ScorePanel
              key={s.id}
              band={s.band}
              source={s.source}
              model={s.model}
              createdAt={s.createdAt}
              criteria={s.criteria as Record<string, number>}
              feedback={s.feedback}
              criteriaLabels={criteriaLabels}
              target={profile.targetBand}
              labels={panelLabels}
              locale={locale}
            />
          ))}

          <Card className="flex flex-col gap-3 p-5">
            <h3 className="font-semibold">{t.writing.aiAssess}</h3>
            {hasKey ? (
              <AiAssessButton submissionId={sub.id} action={aiScoreWritingAction} label={t.writing.aiAssess} pendingLabel={t.common.loading} />
            ) : (
              <Alert>
                {t.writing.aiMissing} <Link href="/settings" className="font-medium text-accent hover:underline">{t.nav.settings} →</Link>
              </Alert>
            )}
          </Card>

          <Card className="p-5">
            <SelfAssessForm
              submissionId={sub.id}
              rubric={WRITING_RUBRIC}
              initial={(sub.scores.find((x) => x.source === "self")?.criteria as Record<string, number> | undefined) ?? undefined}
              criteriaLabels={criteriaLabels}
              action={selfScoreWritingAction}
              labels={{ title: t.writing.selfAssess, save: t.writing.saveScore, notes: t.writing.improvements, saved: t.settings.saved }}
            />
          </Card>

          <SampleAnswers samples={task.samples} title={t.writing.samples} />
        </div>
      </div>
    </div>
  );
}
