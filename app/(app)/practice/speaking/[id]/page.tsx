import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getContent } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { SpeakingTaskView } from "@/components/assess/speaking-task-view";
import { SpeakingRecorder } from "@/components/assess/speaking-recorder";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Speaking practice" };

export default async function SpeakingPracticePage({ params, searchParams }: PageProps<"/practice/speaking/[id]">) {
  const user = await requireLearner();
  const { id } = await params;
  const sp = await searchParams;
  const { t } = await getDictionary();
  const task = await getContent("speaking_task", id);
  if (!task) notFound();

  const attemptId = typeof sp.attempt === "string" ? sp.attempt : undefined;
  const cred = await db.apiCredential.findUnique({ where: { userId: user.id }, select: { provider: true } });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`${t.speaking.part} ${task.part}: ${task.topic}`} />
      <div className="flex flex-col gap-5">
        <SpeakingTaskView task={task} />
        {!attemptId && task.tips.length > 0 && (
          <details className="rounded border border-border bg-surface p-4 text-sm">
            <summary className="cursor-pointer font-medium">{t.writing.tips}</summary>
            <ul className="mt-2 list-disc pl-5">{task.tips.map((tip, i) => <li key={i}>{tip}</li>)}</ul>
            {task.usefulPhrases.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {task.usefulPhrases.map((p, i) => <li key={i} className="rounded bg-surface-2 px-2 py-1 text-xs">{p}</li>)}
              </ul>
            )}
          </details>
        )}
        <Card className="p-5">
          <SpeakingRecorder
            taskId={task.id}
            part={task.part}
            attemptId={attemptId}
            canTranscribe={cred?.provider === "openai"}
            labels={{ ...t.speaking, error: t.common.error }}
          />
        </Card>
      </div>
    </div>
  );
}
