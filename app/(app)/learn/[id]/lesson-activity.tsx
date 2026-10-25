"use client";

import { useState, useTransition } from "react";
import { completeLessonAction } from "@/app/actions/learn";
import { Alert, Badge, Button, Card } from "@/components/ui";

export interface QuizItem {
  prompt: string;
  options: string[];
  answer: number;
  explanation?: string;
}

export interface LessonActivityLabels {
  quiz: string;
  check: string;
  retry: string;
  correct: string;
  incorrect: string;
  score: string;
  answerAll: string;
  markDone: string;
  completed: string;
  saved: string;
  lastDone: string;
  error: string;
}

interface Props {
  lessonId: string;
  quiz: QuizItem[];
  done: boolean;
  lastScore: { score: number; max: number } | null;
  labels: LessonActivityLabels;
}

type Status = { tone: "success" | "danger" | "warning"; text: string } | null;

/** The end-of-lesson self check and the completion button, which sends the quiz along with it. */
export function LessonActivity({ lessonId, quiz, done, lastScore, labels }: Props) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.map(() => null));
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [pending, start] = useTransition();

  const score = answers.reduce<number>((n, a, i) => n + (a === quiz[i].answer ? 1 : 0), 0);

  const choose = (item: number, option: number) =>
    setAnswers((prev) => prev.map((a, i) => (i === item ? option : a)));

  const check = () => {
    if (answers.some((a) => a === null)) {
      setStatus({ tone: "warning", text: labels.answerAll });
      return;
    }
    setStatus(null);
    setChecked(true);
  };

  const retry = () => {
    setAnswers(quiz.map(() => null));
    setChecked(false);
    setStatus(null);
  };

  const complete = () =>
    start(async () => {
      const sent = checked ? answers.filter((a): a is number => a !== null) : undefined;
      const res = await completeLessonAction({ lessonId, answers: sent });
      setStatus(res.ok ? { tone: "success", text: labels.saved } : { tone: "danger", text: labels.error });
    });

  return (
    <div className="flex flex-col gap-6">
      {quiz.length > 0 && (
        <section aria-labelledby="quiz-heading">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="quiz-heading" className="text-lg font-semibold">
              {labels.quiz}
            </h2>
            {checked && (
              <span className="text-sm font-medium tabular-nums" aria-live="polite">
                {labels.score}: {score}/{quiz.length}
              </span>
            )}
          </div>
          <ol className="flex flex-col gap-4">
            {quiz.map((item, i) => (
              <li key={i}>
                <QuizQuestion
                  index={i}
                  item={item}
                  value={answers[i]}
                  checked={checked}
                  labels={labels}
                  onChoose={(o) => choose(i, o)}
                />
              </li>
            ))}
          </ol>
          <div className="mt-4 flex gap-2">
            {checked ? (
              <Button variant="secondary" onClick={retry}>
                {labels.retry}
              </Button>
            ) : (
              <Button variant="secondary" onClick={check}>
                {labels.check}
              </Button>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={complete} disabled={pending}>
            {labels.markDone}
          </Button>
          {done && <Badge tone="success">✓ {labels.completed}</Badge>}
          {lastScore && (
            <span className="text-sm text-muted tabular-nums">
              {labels.lastDone}: {lastScore.score}/{lastScore.max}
            </span>
          )}
        </div>
        <div aria-live="polite">{status && <Alert tone={status.tone}>{status.text}</Alert>}</div>
      </div>
    </div>
  );
}

interface QuestionProps {
  index: number;
  item: QuizItem;
  value: number | null;
  checked: boolean;
  labels: LessonActivityLabels;
  onChoose: (option: number) => void;
}

function QuizQuestion({ index, item, value, checked, labels, onChoose }: QuestionProps) {
  const name = `quiz-${index}`;
  const right = value === item.answer;
  return (
    <Card className="p-4">
      <fieldset disabled={checked}>
        <legend className="mb-3 font-medium">
          {index + 1}. {item.prompt}
        </legend>
        <div className="flex flex-col gap-2">
          {item.options.map((opt, o) => (
            <label key={o} className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-sm ${optionTone(checked, o, item.answer, value)}`}>
              <input type="radio" name={name} className="mt-1" checked={value === o} onChange={() => onChoose(o)} />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {checked && (
        <div className="mt-3 flex flex-col gap-1 text-sm">
          <Badge tone={right ? "success" : "danger"} className="self-start">
            {right ? labels.correct : labels.incorrect}
          </Badge>
          {item.explanation && <p className="text-muted">{item.explanation}</p>}
        </div>
      )}
    </Card>
  );
}

function optionTone(checked: boolean, option: number, answer: number, value: number | null): string {
  if (!checked) return value === option ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2";
  if (option === answer) return "border-success bg-success-soft";
  if (option === value) return "border-danger bg-danger-soft";
  return "border-border opacity-70";
}
