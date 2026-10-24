import type { Dictionary } from "./dictionaries";
import type { RunnerLabels } from "@/components/runner/attempt-runner";
import type { GroupProps } from "@/components/questions/question-group";

/** Flattens the dictionary into the label props client components take. */
export function runnerLabels(t: Dictionary): RunnerLabels {
  return {
    ...t.runner,
    confirm: t.runner.confirmSubmit,
    cancel: t.common.cancel,
    placeholder: t.writing.placeholder,
    task: t.writing.task,
    yourAnswer: t.review.yourAnswer,
    correctAnswer: t.review.correctAnswer,
    evidence: t.review.evidence,
    error: t.common.error,
  };
}

export function groupLabels(t: Dictionary): GroupProps["labels"] {
  return {
    choose: t.runner.choose,
    letters: t.runner.letters,
    yourAnswer: t.review.yourAnswer,
    correctAnswer: t.review.correctAnswer,
    evidence: t.review.evidence,
  };
}
