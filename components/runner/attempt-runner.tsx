"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { useRouter } from "next/navigation";
import type { QuestionSet, WritingTask } from "@/lib/content/schema";
import type { AnswerMap } from "@/lib/scoring/grade";
import type { Annotation } from "@/lib/attempt/sections";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { adjacentNumber, answerProgress, flagKey, isAnswered, paletteGroups, toggleFlag } from "@/lib/exam/navigation";
import { advanceAttemptAction } from "@/app/actions/attempts";
import { Button } from "@/components/ui";
import { type PlayerLabels } from "./listening-player";
import { WritingPrompt } from "./writing-prompt";
import { EssayEditor } from "./essay-editor";
import { useAutosave } from "./use-autosave";
import { Clock } from "./clock";
import { ExamHeader } from "./exam-header";
import { contrastStyle, useExamSettings, useRootTextSize } from "./exam-settings";
import { Palette } from "./palette";
import { SetView } from "./set-view";
import { useExamKeys } from "./use-exam-keys";

export type RunnerSection =
  | { kind: "sets"; skill: "listening" | "reading" | "grammar"; sets: QuestionSet[]; minutes: number }
  | { kind: "writing"; tasks: WritingTask[]; minutes: number };

export interface RunnerLabels extends PlayerLabels {
  submit: string;
  next: string;
  confirm: string;
  cancel: string;
  unanswered: string;
  saved: string;
  saving: string;
  timeLeft: string;
  choose: string;
  letters: string;
  words: string;
  placeholder: string;
  task: string;
  yourAnswer: string;
  correctAnswer: string;
  evidence: string;
  error: string;
}

interface RunnerProps {
  attemptId: string;
  strict: boolean;
  title: string;
  candidate: string;
  sectionIndex: number;
  sectionLabel: string;
  isLast: boolean;
  section: RunnerSection;
  initialAnswers: Record<string, AnswerMap>;
  initialEssays: Record<string, string>;
  initialAnnotations: Record<string, Annotation[]>;
  initialFlags: Record<string, number[]>;
  deadline: string | null;
  startedAt: string;
  /** Server time at render, so a device with a wrong clock cannot end a section early. */
  serverNow: string;
  labels: RunnerLabels;
  exam: ExamLabels;
}

const EMPTY_SETS: QuestionSet[] = [];
const EMPTY_ANSWERS: AnswerMap = {};
const EMPTY_ANNOTATIONS: Annotation[] = [];
const EMPTY_FLAGS: number[] = [];
const noop = () => undefined;

export function AttemptRunner(props: RunnerProps) {
  const { attemptId, sectionIndex, section, labels, exam, strict } = props;
  const router = useRouter();
  const [settings] = useExamSettings();
  useRootTextSize(settings.textSize);

  const [answers, setAnswers] = useState(props.initialAnswers);
  const [essays, setEssays] = useState(props.initialEssays);
  const [annotations, setAnnotations] = useState(props.initialAnnotations);
  const [flags, setFlags] = useState(props.initialFlags);
  const [tab, setTab] = useState(0);
  const [current, setCurrent] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const buildPayload = () => ({ attemptId, section: sectionIndex, answers, essays, annotations, flags });
  const dirtyKey = useMemo(() => [answers, essays, annotations, flags], [answers, essays, annotations, flags]);
  const { status } = useAutosave(buildPayload, dirtyKey);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(false);
    try {
      const res = await advanceAttemptAction(buildPayload());
      if (!res.ok) throw new Error("advance failed");
      setConfirming(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Strict sections close themselves when the clock runs out.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  const onExpire = useCallback(() => void submitRef.current(), []);

  const sets = section.kind === "sets" ? section.sets : EMPTY_SETS;
  const groups = useMemo(() => (section.kind === "sets" ? paletteGroups(section.skill, section.sets) : []), [section]);
  const order = useMemo(() => groups.flatMap((g) => g.numbers), [groups]);
  const numberToTab = useMemo(() => new Map(groups.flatMap((g) => g.numbers.map((n) => [n, g.setIndex] as const))), [groups]);
  const progress = useMemo(
    () =>
      section.kind === "sets"
        ? answerProgress(section.sets, answers)
        : { answered: section.tasks.filter((t) => (essays[t.id] ?? "").trim()).length, total: section.tasks.length },
    [section, answers, essays],
  );

  const tabs = section.kind === "sets" ? groups.map((g) => g.label) : section.tasks.map((t) => `${labels.task} ${t.task}`);

  // Stable per-set handlers, so SetView (memoised) only re-renders when its own data changes.
  const flipFlag = useCallback((setId: string, n: number) => setFlags((prev) => ({ ...prev, [setId]: toggleFlag(prev[setId] ?? [], n) })), []);
  const handlers = useMemo(
    () =>
      new Map(
        sets.map((s) => [
          s.id,
          {
            answer: (key: string, value: string | string[]) => setAnswers((prev) => ({ ...prev, [s.id]: { ...prev[s.id], [key]: value } })),
            annotate: (next: Annotation[]) => setAnnotations((prev) => ({ ...prev, [s.id]: next })),
            flag: (n: number) => flipFlag(s.id, n),
          },
        ]),
      ),
    [sets, flipFlag],
  );

  const jump = (n: number) => {
    const t = numberToTab.get(n);
    if (t === undefined) return;
    setTab(t);
    setCurrent(n);
    const anchor = flagKey(sets[t], n);
    window.setTimeout(() => {
      const el = document.getElementById(`q-${anchor}`);
      if (!el) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
    }, 50);
  };

  const step = (dir: 1 | -1) => {
    const n = adjacentNumber(order, current, dir);
    if (n !== null) jump(n);
  };

  const flagCurrent = () => {
    if (current === null) return;
    const t = numberToTab.get(current);
    if (t !== undefined) flipFlag(sets[t].id, flagKey(sets[t], current));
  };
  const currentSet = current !== null ? numberToTab.get(current) : undefined;
  const currentFlagged = current !== null && currentSet !== undefined && (flags[sets[currentSet].id] ?? []).includes(flagKey(sets[currentSet], current));

  useExamKeys({ onStep: step, onFlag: flagCurrent });

  // The question being worked on follows focus (clicking or tabbing into an answer).
  const trackFocus = (e: FocusEvent<HTMLDivElement>) => {
    const holder = (e.target as Element).closest("[id^='q-']");
    const n = holder ? Number.parseInt(holder.id.slice(2), 10) : Number.NaN;
    if (Number.isInteger(n) && numberToTab.has(n)) setCurrent(n);
  };

  const actionLabel = props.isLast ? labels.submit : labels.next;
  const statusText = status === "saving" ? labels.saving : status === "saved" ? labels.saved : status === "error" ? labels.error : "";

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-bg text-fg" style={contrastStyle(settings.contrast)} data-contrast={settings.contrast} data-text-size={settings.textSize}>
      <ExamHeader candidate={props.candidate} title={props.title} section={props.sectionLabel} labels={exam}>
        <span className="text-xs text-muted" aria-live="polite">
          {statusText}
        </span>
        <Clock deadline={props.deadline} startedAt={props.startedAt} serverNow={props.serverNow} minutes={section.minutes} label={labels.timeLeft} onExpire={onExpire} />
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm lg:inline">{labels.confirm}</span>
            <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
              {labels.cancel}
            </Button>
            <Button size="sm" onClick={() => void submit()} disabled={submitting}>
              {actionLabel}
            </Button>
          </div>
        ) : (
          <Button size="sm" onClick={() => setConfirming(true)} disabled={submitting}>
            {actionLabel}
          </Button>
        )}
      </ExamHeader>

      {error && <p className="bg-danger-soft px-6 py-2 text-sm text-danger">{labels.error}</p>}

      {tabs.length > 1 && (
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 sm:px-6" aria-label="Parts">
          {tabs.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setTab(i)}
              aria-current={tab === i}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === i ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"}`}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      <div className="flex flex-1 flex-col" onFocus={trackFocus}>
        {section.kind === "sets"
          ? section.sets.map((set, i) => (
              <div key={set.id} hidden={tab !== i} className="flex flex-1 flex-col">
                <SetView
                  set={set}
                  partLabel={groups[i]?.label ?? ""}
                  answers={answers[set.id] ?? EMPTY_ANSWERS}
                  onAnswer={handlers.get(set.id)?.answer ?? noop}
                  annotations={annotations[set.id] ?? EMPTY_ANNOTATIONS}
                  onAnnotations={handlers.get(set.id)?.annotate ?? noop}
                  flags={flags[set.id] ?? EMPTY_FLAGS}
                  onToggleFlag={handlers.get(set.id)?.flag ?? noop}
                  strict={strict}
                  font={settings.font}
                  labels={labels}
                  exam={exam}
                />
              </div>
            ))
          : section.tasks.map((task, i) => (
              <div key={task.id} hidden={tab !== i} className="grid gap-6 p-4 sm:p-6 lg:grid-cols-2">
                <WritingPrompt task={task} />
                <EssayEditor
                  value={essays[task.id] ?? ""}
                  onChange={(v) => setEssays((prev) => ({ ...prev, [task.id]: v }))}
                  minWords={task.minWords}
                  placeholder={labels.placeholder}
                  wordsLabel={labels.words}
                />
              </div>
            ))}
      </div>

      {section.kind === "sets" && (
        <Palette
          groups={groups}
          activeSet={tab}
          current={current}
          answered={progress.answered}
          total={progress.total}
          isAnswered={(si, n) => isAnswered(sets[si], answers[sets[si].id] ?? {}, n)}
          isFlagged={(si, n) => (flags[sets[si].id] ?? []).includes(flagKey(sets[si], n))}
          onJump={jump}
          onStep={step}
          canStep={{ prev: adjacentNumber(order, current, -1) !== null && current !== null, next: adjacentNumber(order, current, 1) !== null }}
          currentFlagged={currentFlagged}
          onFlagCurrent={flagCurrent}
          labels={{ ...exam, unanswered: labels.unanswered }}
        />
      )}
    </div>
  );
}
