"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { QuestionSet, WritingTask } from "@/lib/content/schema";
import type { AnswerMap } from "@/lib/scoring/grade";
import { setNumbers, groupNumbers } from "@/lib/content/check";
import { advanceAttemptAction } from "@/app/actions/attempts";
import { QuestionGroupView } from "@/components/questions/question-group";
import { Passage } from "./passage";
import { ListeningPlayer, type PlayerLabels } from "./listening-player";
import { WritingPrompt } from "./writing-prompt";
import { EssayEditor } from "./essay-editor";
import { useAutosave } from "./use-autosave";
import { Button } from "@/components/ui";

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
  sectionIndex: number;
  sectionLabel: string;
  isLast: boolean;
  section: RunnerSection;
  initialAnswers: Record<string, AnswerMap>;
  initialEssays: Record<string, string>;
  deadline: string | null;
  startedAt: string;
  /** Server time at render, so a device with a wrong clock cannot end a section early. */
  serverNow: string;
  labels: RunnerLabels;
}

export function AttemptRunner(props: RunnerProps) {
  const { attemptId, sectionIndex, section, labels, strict } = props;
  const router = useRouter();
  const [answers, setAnswers] = useState(props.initialAnswers);
  const [essays, setEssays] = useState(props.initialEssays);
  const [tab, setTab] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const buildPayload = () => ({ attemptId, section: sectionIndex, answers, essays });
  const { status } = useAutosave(buildPayload, section.kind === "sets" ? answers : essays);

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

  const tabs = section.kind === "sets" ? section.sets.map((s, i) => tabLabel(section.skill, s, i)) : section.tasks.map((t) => `${labels.task} ${t.task}`);

  const { total, answered, numberToTab } = useMemo(() => {
    if (section.kind !== "sets") {
      return { total: section.tasks.length, answered: section.tasks.filter((t) => (essays[t.id] ?? "").trim()).length, numberToTab: new Map<number, number>() };
    }
    const map = new Map<number, number>();
    let count = 0;
    let done = 0;
    section.sets.forEach((set, i) => {
      for (const n of setNumbers(set)) map.set(n, i);
      for (const g of set.groups) {
        if (g.type === "mcq_multi") {
          for (const q of g.questions) {
            const v = answers[set.id]?.[q.numbers[0]];
            count += q.numbers.length;
            done += Math.min(q.numbers.length, Array.isArray(v) ? v.length : 0);
          }
        } else {
          for (const n of groupNumbers(g)) {
            count++;
            if (String(answers[set.id]?.[n] ?? "").trim()) done++;
          }
        }
      }
    });
    return { total: count, answered: done, numberToTab: map };
  }, [section, answers, essays]);

  const setAnswer = (setId: string) => (key: string, value: string | string[]) =>
    setAnswers((prev) => ({ ...prev, [setId]: { ...prev[setId], [key]: value } }));

  const jump = (n: number) => {
    const t = numberToTab.get(n);
    if (t !== undefined) setTab(t);
    window.setTimeout(() => document.getElementById(`q-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const actionLabel = props.isLast ? labels.submit : labels.next;

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-56px)] flex-col sm:-mx-8 sm:-my-8 lg:min-h-screen">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-surface px-4 py-2.5 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">{props.title}</p>
          <p className="truncate font-semibold">{props.sectionLabel}</p>
        </div>
        <span className="text-xs text-muted" aria-live="polite">
          {status === "saving" ? labels.saving : status === "saved" ? labels.saved : status === "error" ? labels.error : ""}
        </span>
        <Clock deadline={props.deadline} startedAt={props.startedAt} serverNow={props.serverNow} minutes={section.minutes} label={labels.timeLeft} onExpire={() => void submitRef.current()} />
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm sm:inline">{labels.confirm}</span>
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
      </header>

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

      <div className="flex-1">
        {section.kind === "sets" ? (
          section.sets.map((set, i) => (
            <div key={set.id} hidden={tab !== i}>
              <SetView set={set} answers={answers[set.id] ?? {}} onAnswer={setAnswer(set.id)} strict={strict} labels={labels} />
            </div>
          ))
        ) : (
          section.tasks.map((task, i) => (
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
          ))
        )}
      </div>

      {section.kind === "sets" && (
        <footer className="sticky bottom-0 z-10 flex items-center gap-3 border-t border-border bg-surface px-4 py-2 sm:px-6">
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {answered}/{total}
          </span>
          <div className="flex flex-1 gap-1 overflow-x-auto py-1">
            {[...numberToTab.keys()].map((n) => {
              const set = section.sets[numberToTab.get(n) ?? 0];
              const done = isAnswered(set, answers[set.id] ?? {}, n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => jump(n)}
                  aria-label={`Question ${n}${done ? "" : `, ${labels.unanswered}`}`}
                  className={`h-7 min-w-7 shrink-0 rounded border text-xs font-medium tabular-nums ${done ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-fg"}`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </footer>
      )}
    </div>
  );
}

function tabLabel(skill: string, set: QuestionSet, i: number): string {
  if (skill === "listening") return `Part ${set.part ?? i + 1}`;
  if (skill === "reading") return `Passage ${i + 1}`;
  return set.title;
}

function isAnswered(set: QuestionSet, answers: AnswerMap, n: number): boolean {
  for (const g of set.groups) {
    if (g.type !== "mcq_multi") continue;
    for (const q of g.questions) {
      const idx = q.numbers.indexOf(n);
      if (idx >= 0) {
        const v = answers[q.numbers[0]];
        return Array.isArray(v) && v.length > idx;
      }
    }
  }
  return String(answers[n] ?? "").trim().length > 0;
}

function SetView({
  set,
  answers,
  onAnswer,
  strict,
  labels,
}: {
  set: QuestionSet;
  answers: AnswerMap;
  onAnswer: (key: string, value: string | string[]) => void;
  strict: boolean;
  labels: RunnerLabels;
}) {
  const groups = (
    <div className="flex flex-col gap-10">
      {set.groups.map((g, i) => (
        <QuestionGroupView key={i} group={g} answers={answers} onAnswer={onAnswer} labels={labels} />
      ))}
    </div>
  );

  if (set.passage) {
    return (
      <div className="grid lg:h-[calc(100vh-150px)] lg:grid-cols-2">
        <div className="border-b border-border p-4 sm:p-6 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <Passage passage={set.passage} />
        </div>
        <div className="p-4 sm:p-6 lg:overflow-y-auto">{groups}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-4 sm:p-6">
      {set.audio && (
        <div className="rounded border border-border bg-surface p-4">
          <ListeningPlayer audio={set.audio} strict={strict} labels={labels} />
        </div>
      )}
      {groups}
    </div>
  );
}

/** Countdown to a deadline, or (practice) time spent against the recommended minutes. */
function Clock({
  deadline,
  startedAt,
  serverNow,
  minutes,
  label,
  onExpire,
}: {
  deadline: string | null;
  startedAt: string;
  serverNow: string;
  minutes: number;
  label: string;
  onExpire: () => void;
}) {
  // Starts from the server's clock (identical on server and client, so no hydration
  // mismatch) and then advances by elapsed local time, which is immune to a wrong device clock.
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  const fired = useRef(false);

  useEffect(() => {
    const base = new Date(serverNow).getTime();
    const mountedAt = performance.now();
    const t = window.setInterval(() => setNow(base + (performance.now() - mountedAt)), 1000);
    return () => window.clearInterval(t);
  }, [serverNow]);

  const remaining = deadline ? new Date(deadline).getTime() - now : null;
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !fired.current) {
      fired.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);

  if (remaining !== null) {
    const s = Math.max(0, Math.floor(remaining / 1000));
    const low = s < 5 * 60;
    return (
      <span className={`rounded border px-2 py-1 text-sm font-semibold tabular-nums ${low ? "border-danger text-danger" : "border-border"}`} aria-label={label}>
        {fmtClock(s)}
      </span>
    );
  }

  const spent = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return (
    <span className={`text-sm tabular-nums ${spent > minutes * 60 ? "text-warning" : "text-muted"}`}>
      {fmtClock(spent)} / {minutes}:00
    </span>
  );
}

function fmtClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  return `${h ? `${h}:` : ""}${mm}:${String(s).padStart(2, "0")}`;
}
