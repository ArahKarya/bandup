"use client";

import { memo, useMemo } from "react";
import type { QuestionSet } from "@/lib/content/schema";
import type { AnswerMap } from "@/lib/scoring/grade";
import type { Annotation } from "@/lib/attempt/sections";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import type { PassageFont } from "@/lib/exam/settings";
import { numberRange } from "@/lib/exam/navigation";
import { QuestionExtrasContext, QuestionGroupView, type QuestionExtras } from "@/components/questions/question-group";
import { Annotatable } from "./annotatable";
import { FlagToggle } from "./flag-toggle";
import { ListeningPlayer, type PlayerLabels } from "./listening-player";
import { Passage } from "./passage";
import { SplitPane } from "./split-pane";

export interface SetViewLabels extends PlayerLabels {
  choose: string;
  letters: string;
  yourAnswer: string;
  correctAnswer: string;
  evidence: string;
}

interface SetViewProps {
  set: QuestionSet;
  partLabel: string;
  answers: AnswerMap;
  onAnswer: (key: string, value: string | string[]) => void;
  annotations: readonly Annotation[];
  onAnnotations: (next: Annotation[]) => void;
  flags: readonly number[];
  onToggleFlag: (n: number) => void;
  strict: boolean;
  font: PassageFont;
  labels: SetViewLabels;
  exam: ExamLabels;
}

/** One question set: a reading passage beside its questions, or the listening player above them. */
export const SetView = memo(function SetView({ set, partLabel, answers, onAnswer, annotations, onAnnotations, flags, onToggleFlag, strict, font, labels, exam }: SetViewProps) {
  const extras = useMemo<QuestionExtras>(
    () => ({ actions: (n) => <FlagToggle n={n} flagged={flags.includes(n)} onToggle={() => onToggleFlag(n)} labels={exam} /> }),
    [flags, onToggleFlag, exam],
  );

  const groups = (
    <QuestionExtrasContext.Provider value={extras}>
      <div className="flex flex-col gap-10">
        {set.groups.map((g, i) => (
          <QuestionGroupView key={i} group={g} answers={answers} onAnswer={onAnswer} labels={labels} />
        ))}
      </div>
    </QuestionExtrasContext.Provider>
  );

  if (set.passage) {
    const passage = set.passage;
    return (
      <SplitPane
        labels={exam}
        passage={
          <Annotatable annotations={annotations} onChange={onAnnotations} labels={exam}>
            {(renderText) => <Passage passage={passage} setId={set.id} renderText={renderText} font={font} />}
          </Annotatable>
        }
        questions={groups}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 sm:p-6">
      {set.audio && (
        <div className="rounded border border-border bg-surface p-4">
          <ListeningPlayer
            audio={set.audio}
            strict={strict}
            labels={labels}
            exam={exam}
            setId={set.id}
            partLabel={partLabel}
            range={numberRange(set)}
            annotations={annotations}
            onAnnotationsChange={onAnnotations}
          />
        </div>
      )}
      {groups}
    </div>
  );
});
