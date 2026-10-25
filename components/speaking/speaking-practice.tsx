"use client";

import { Mic, UserRound } from "lucide-react";
import type { SpeakingTask } from "@/lib/content/schema";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { Tabs } from "@/components/ui/tabs";
import { SpeakingRecorder } from "@/components/assess/speaking-recorder";
import { Examiner } from "./examiner";
import type { RecorderLabels } from "./submit-panel";

interface SpeakingPracticeProps {
  task: SpeakingTask;
  attemptId?: string;
  canTranscribe: boolean;
  labels: RecorderLabels;
  exam: ExamLabels;
}

/** Speaking practice: the examiner simulation or a free recording of the same task. */
export function SpeakingPractice({ task, attemptId, canTranscribe, labels, exam }: SpeakingPracticeProps) {
  return (
    <Tabs
      items={[
        {
          id: "examiner",
          label: (
            <>
              <UserRound size={15} aria-hidden="true" />
              {exam.examinerMode}
            </>
          ),
          content: <Examiner task={task} attemptId={attemptId} canTranscribe={canTranscribe} labels={labels} exam={exam} />,
        },
        {
          id: "free",
          label: (
            <>
              <Mic size={15} aria-hidden="true" />
              {exam.freeMode}
            </>
          ),
          content: <SpeakingRecorder taskId={task.id} part={task.part} attemptId={attemptId} canTranscribe={canTranscribe} labels={labels} />,
        },
      ]}
    />
  );
}
