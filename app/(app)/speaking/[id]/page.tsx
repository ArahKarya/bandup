import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getContent } from "@/lib/server/content";
import { getProfile } from "@/lib/server/profile";
import { db } from "@/lib/server/db";
import { SPEAKING_RUBRIC } from "@/lib/scoring/rubric";
import { aiScoreSpeakingAction, selfScoreSpeakingAction, updateTranscriptAction } from "@/app/actions/assess";
import { SpeakingTaskView } from "@/components/assess/speaking-task-view";
import { AiAssessButton, SelfAssessForm } from "@/components/assess/assessment-forms";
import { TranscriptForm } from "@/components/assess/transcript-form";
import { ScorePanel } from "@/components/assess/score-panel";
import { SampleAnswers } from "@/components/assess/sample-answers";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Speaking feedback" };

export default async function SpeakingSubmissionPage({ params }: PageProps<"/speaking/[id]">) {
  const user = await requireLearner();
  const { id } = await params;
  const { t, locale } = await getDictionary();

  const sub = await db.speakingSubmission.findFirst({ where: { id, userId: user.id }, include: { scores: { orderBy: { createdAt: "desc" } } } });
  if (!sub) notFound();
  const task = await getContent("speaking_task", sub.taskId);
  if (!task) notFound();
  const profile = await getProfile(user.id);
  const hasKey = Boolean(await db.apiCredential.findUnique({ where: { userId: user.id }, select: { userId: true } }));
  const criteriaLabels: Record<string, string> = t.speaking.criteria;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`${t.speaking.part} ${task.part}: ${task.topic}`}
        actions={
          <>
            {sub.attemptId && <LinkButton href={`/attempt/${sub.attemptId}`} variant="secondary">{t.review.title}</LinkButton>}
            <LinkButton href={`/practice/speaking/${task.id}`} variant="secondary">{t.practice.retry}</LinkButton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SpeakingTaskView task={task} />
          {sub.audioPath && <audio controls src={`/api/speaking/${sub.id}/audio`} className="w-full" />}
          <Card className="p-5">
            <TranscriptForm submissionId={sub.id} initial={sub.transcript} action={updateTranscriptAction} labels={{ title: t.speaking.transcript, hint: t.speaking.transcriptHint, save: t.common.save, saved: t.settings.saved }} />
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          {sub.scores.map((s) => (
            <ScorePanel key={s.id} band={s.band} source={s.source} model={s.model} createdAt={s.createdAt} criteria={s.criteria as Record<string, number>} feedback={s.feedback} criteriaLabels={criteriaLabels} target={profile.targetBand} locale={locale}
              labels={{ strengths: t.writing.strengths, improvements: t.writing.improvements, corrections: t.writing.corrections, ai: "AI", self: t.writing.selfAssess }} />
          ))}
          <Card className="flex flex-col gap-3 p-5">
            <h3 className="font-semibold">{t.writing.aiAssess}</h3>
            {hasKey ? (
              <AiAssessButton submissionId={sub.id} action={aiScoreSpeakingAction} label={t.writing.aiAssess} pendingLabel={t.common.loading} />
            ) : (
              <Alert>{t.writing.aiMissing} <Link href="/settings" className="font-medium text-accent hover:underline">{t.nav.settings} →</Link></Alert>
            )}
          </Card>
          <Card className="p-5">
            <SelfAssessForm submissionId={sub.id} rubric={SPEAKING_RUBRIC} criteriaLabels={criteriaLabels} action={selfScoreSpeakingAction}
              labels={{ title: t.writing.selfAssess, save: t.writing.saveScore, notes: t.writing.improvements, saved: t.settings.saved }} />
          </Card>
          <SampleAnswers samples={task.samples} title={t.writing.samples} />
        </div>
      </div>
    </div>
  );
}
