"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Play } from "lucide-react";
import type { SpeakingTask } from "@/lib/content/schema";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { Badge, Button, Card } from "@/components/ui";
import { SpeakingTaskView } from "@/components/assess/speaking-task-view";
import { Examiner } from "./examiner";
import type { RecorderLabels } from "./submit-panel";

interface MockSpeakingProps {
  attemptId: string;
  tasks: SpeakingTask[];
  done: string[];
  canTranscribe: boolean;
  partLabel: string;
  labels: RecorderLabels;
  exam: ExamLabels;
}

/** The mock test's Speaking section: one row per part; each part runs the examiner flow in place. */
export function MockSpeaking({ attemptId, tasks, done, canTranscribe, partLabel, labels, exam }: MockSpeakingProps) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const task = tasks.find((t) => t.id === open);

  if (task) {
    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => setOpen(null)} className="inline-flex items-center gap-1 self-start text-sm text-muted hover:text-fg">
          <ChevronLeft size={16} aria-hidden="true" />
          {partLabel} {task.part}: {task.topic}
        </button>
        {task.cueCard && <SpeakingTaskView task={task} />}
        <Card className="p-5">
          <Examiner
            key={task.id}
            task={task}
            attemptId={attemptId}
            canTranscribe={canTranscribe}
            labels={labels}
            exam={exam}
            onSubmitted={() => {
              setOpen(null);
              router.refresh();
            }}
          />
        </Card>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {tasks.map((t) => (
        <li key={t.id}>
          <Card className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm text-speaking">
                {partLabel} {t.part}
              </p>
              <p className="font-medium">{t.topic}</p>
            </div>
            {done.includes(t.id) ? (
              <Badge tone="success">
                <Check size={12} aria-hidden="true" className="mr-1" />
                {exam.partDone}
              </Badge>
            ) : (
              <Button type="button" size="sm" onClick={() => setOpen(t.id)}>
                <Play size={14} aria-hidden="true" />
                {exam.openPart}
              </Button>
            )}
          </Card>
        </li>
      ))}
    </ol>
  );
}
