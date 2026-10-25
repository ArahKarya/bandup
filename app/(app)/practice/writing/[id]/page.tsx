import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getContent } from "@/lib/server/content";
import { fmt } from "@/lib/i18n/dictionaries";
import { writingContext } from "@/lib/writing/task-kind";
import { WritingPrompt } from "@/components/runner/writing-prompt";
import { WritingPractice } from "@/components/assess/writing-practice";
import { PenLine } from "lucide-react";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Writing practice" };

export default async function WritingPracticePage({ params }: PageProps<"/practice/writing/[id]">) {
  await requireLearner();
  const { id } = await params;
  const { t } = await getDictionary();
  const task = await getContent("writing_task", id);
  if (!task) notFound();

  const prompt = (
    <>
      <WritingPrompt task={task} />
      {task.tips.length > 0 && (
        <details className="rounded border border-border bg-surface p-4 text-sm">
          <summary className="cursor-pointer font-medium">{t.writing.tips}</summary>
          <ul className="mt-2 list-disc pl-5">
            {task.tips.map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </details>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        icon={<PenLine size={20} aria-hidden="true" />}
        title={`${t.writing.task} ${task.task}: ${task.title}`}
        sub={`${fmt(t.writing.minWords, { n: task.minWords })} ${fmt(t.writing.suggested, { n: task.minutes })}`}
      />
      <WritingPractice
        taskId={task.id}
        minWords={task.minWords}
        minutes={task.minutes}
        context={writingContext(task)}
        prompt={prompt}
        labels={{ placeholder: t.writing.placeholder, words: t.runner.words, submit: t.writing.submit, tooShort: t.writing.tooShort, timeLeft: t.runner.timeLeft }}
        assist={t.assist}
      />
    </div>
  );
}
