"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Play, Repeat, SkipForward, Square } from "lucide-react";
import type { SpeakingTask } from "@/lib/content/schema";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { ANSWER_SEC, LONG_TURN_SEC, PART2_START, PART2_STOP, PREP_SEC, part2Intro, partOpening } from "@/lib/exam/speaking";
import { fill } from "@/lib/exam/text";
import { Alert, Button, Textarea } from "@/components/ui";
import { pickVoice, speakOnce, speechSupported, useSpeechSupported, useVoices } from "@/components/runner/use-speech-script";
import { useRecorder } from "./use-recorder";
import { SubmitPanel, type RecorderLabels } from "./submit-panel";
import { AnswerTimer, ExaminerStatus, QuestionText } from "./examiner-parts";

type Stage =
  | { kind: "intro" }
  | { kind: "cue" }
  | { kind: "prep" }
  | { kind: "long" }
  | { kind: "ask"; q: number }
  | { kind: "answer"; q: number }
  | { kind: "review" };

interface ExaminerProps {
  task: SpeakingTask;
  attemptId?: string;
  canTranscribe: boolean;
  labels: RecorderLabels;
  exam: ExamLabels;
  onSubmitted?: (result: { id: string; attemptId: string | null }) => void;
}

/**
 * Speaking test simulation. Parts 1 and 3: the examiner (speech synthesis, British voice)
 * asks each question and recording resumes when it finishes. Part 2: the cue card is read,
 * one minute to prepare, two minutes to talk (auto-stop), then rounding-off questions.
 * The whole part is one recording and one submission.
 */
export function Examiner({ task, attemptId, canTranscribe, labels, exam, onSubmitted }: ExaminerProps) {
  const recorder = useRecorder();
  const { pause, resume, stop, seconds } = recorder;
  const voices = useVoices();
  const [stage, setStage] = useState<Stage>({ kind: "intro" });
  const [speaking, setSpeaking] = useState(false);
  const [showText, setShowText] = useState(false);
  const [prepLeft, setPrepLeft] = useState(PREP_SEC);
  const [notes, setNotes] = useState("");
  const [answerFrom, setAnswerFrom] = useState(0);
  const alive = useRef(true);

  const supported = useSpeechSupported();
  const canSpeak = supported && (voices.length === 0 || voices.some((v) => v.lang.toLowerCase().startsWith("en")));
  const textShown = showText || !canSpeak;
  const questions = task.questions;
  const part = task.part;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (speechSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  /** The examiner talks; the recording is paused meanwhile so only the candidate is captured. */
  const say = useCallback(
    async (text: string) => {
      pause();
      setSpeaking(true);
      await speakOnce(text, pickVoice(voices, { accent: "en-GB", voice: "female" }), 0.95);
      if (alive.current) setSpeaking(false);
      return alive.current;
    },
    [pause, voices],
  );

  const finish = useCallback(() => {
    stop();
    setStage({ kind: "review" });
  }, [stop]);

  const ask = useCallback(
    async (q: number) => {
      setStage({ kind: "ask", q });
      const lead = q === 0 ? (part === 2 ? PART2_STOP : partOpening(part, task.topic)) : "";
      if (!(await say(`${lead} ${questions[q]}`.trim()))) return;
      resume(true);
      setAnswerFrom(seconds);
      setStage({ kind: "answer", q });
    },
    [part, questions, resume, say, seconds, task.topic],
  );

  const afterLongTurn = useCallback(async () => {
    if (questions.length > 0) await ask(0);
    else if (await say(PART2_STOP)) finish();
  }, [ask, finish, questions.length, say]);

  const begin = async () => {
    if (!(await recorder.start())) return;
    pause();
    if (part !== 2) {
      await ask(0);
      return;
    }
    setStage({ kind: "cue" });
    if (!task.cueCard || !(await say(part2Intro(task.cueCard)))) return;
    setPrepLeft(PREP_SEC);
    setStage({ kind: "prep" });
  };

  const startLongTurn = useCallback(async () => {
    setStage({ kind: "cue" });
    if (!(await say(PART2_START))) return;
    resume(false);
    setAnswerFrom(seconds);
    setStage({ kind: "long" });
  }, [resume, say, seconds]);

  const next = () => {
    if (stage.kind !== "answer") return;
    if (stage.q + 1 < questions.length) void ask(stage.q + 1);
    else finish();
  };

  // Clock-driven transitions run from timers (not render effects) and read the latest values.
  const latest = useRef({ seconds, answerFrom, startLongTurn, afterLongTurn });
  useEffect(() => {
    latest.current = { seconds, answerFrom, startLongTurn, afterLongTurn };
  });

  // Preparation countdown, then the long turn starts on its own.
  useEffect(() => {
    if (stage.kind !== "prep") return;
    const endsAt = performance.now() + PREP_SEC * 1000;
    const t = window.setInterval(() => {
      const left = Math.ceil((endsAt - performance.now()) / 1000);
      setPrepLeft(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(t);
        void latest.current.startLongTurn();
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [stage.kind]);

  // The long turn stops at two minutes, as the examiner would stop the candidate.
  useEffect(() => {
    if (stage.kind !== "long") return;
    const t = window.setInterval(() => {
      const l = latest.current;
      if (l.seconds - l.answerFrom < LONG_TURN_SEC) return;
      window.clearInterval(t);
      void l.afterLongTurn();
    }, 500);
    return () => window.clearInterval(t);
  }, [stage.kind]);

  const restart = () => {
    recorder.reset();
    setNotes("");
    setStage({ kind: "intro" });
  };

  const current = stage.kind === "ask" || stage.kind === "answer" ? questions[stage.q] : null;

  return (
    <div className="flex flex-col gap-4">
      {recorder.micDenied && <Alert tone="danger">{labels.micDenied}</Alert>}
      {!canSpeak && stage.kind !== "review" && <Alert tone="warning">{exam.noTts}</Alert>}

      {stage.kind === "intro" && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">{exam.examinerIntro}</p>
          <Button type="button" size="lg" onClick={() => void begin()}>
            <Play size={16} aria-hidden="true" />
            {exam.startExaminer}
          </Button>
        </div>
      )}

      {stage.kind === "cue" && <ExaminerStatus speaking={speaking} labels={exam} />}

      {stage.kind === "prep" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{exam.prepTitle}</span>
            <span className="text-2xl font-semibold tabular-nums" role="timer">
              0:{String(Math.max(0, prepLeft)).padStart(2, "0")}
            </span>
          </div>
          <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={exam.notes} aria-label={exam.notes} />
          <div>
            <Button type="button" onClick={() => void startLongTurn()}>
              <Mic size={16} aria-hidden="true" />
              {exam.startTalking}
            </Button>
          </div>
        </div>
      )}

      {stage.kind === "long" && (
        <div className="flex flex-col gap-3">
          <p className="font-medium">{exam.longTurn}</p>
          <AnswerTimer elapsed={seconds - answerFrom} target={LONG_TURN_SEC} hard labels={exam} />
          {notes && <p className="whitespace-pre-line rounded bg-surface-2 p-3 text-sm">{notes}</p>}
          <LiveCaption text={recorder.transcript} interim={recorder.interim} />
          <div>
            <Button type="button" variant="secondary" onClick={() => void afterLongTurn()}>
              <SkipForward size={16} aria-hidden="true" />
              {questions.length ? exam.roundingOff : exam.finishPart}
            </Button>
          </div>
        </div>
      )}

      {current !== null && (stage.kind === "ask" || stage.kind === "answer") && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-speaking">
            {part === 2 ? `${exam.roundingOff} · ` : ""}
            {fill(exam.questionOf, { n: stage.q + 1, total: questions.length })}
          </p>
          <QuestionText text={current} shown={textShown} canToggle={canSpeak} onToggle={() => setShowText((s) => !s)} labels={exam} />
          {stage.kind === "ask" ? (
            <ExaminerStatus speaking={speaking} labels={exam} />
          ) : (
            <>
              <AnswerTimer elapsed={seconds - answerFrom} target={ANSWER_SEC[part]} labels={exam} />
              <LiveCaption text={recorder.transcript.split("\n").at(-1) ?? ""} interim={recorder.interim} />
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={next}>
                  {stage.q + 1 < questions.length ? (
                    <>
                      <SkipForward size={16} aria-hidden="true" />
                      {exam.nextQuestion}
                    </>
                  ) : (
                    <>
                      <Square size={14} aria-hidden="true" className="fill-current" />
                      {exam.finishPart}
                    </>
                  )}
                </Button>
                {canSpeak && (
                  <Button type="button" variant="ghost" onClick={() => void say(current).then((ok) => ok && resume(false))}>
                    <Repeat size={16} aria-hidden="true" />
                    {exam.repeatQuestion}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {stage.kind === "review" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{exam.reviewPart}</p>
          <SubmitPanel taskId={task.id} attemptId={attemptId} canTranscribe={canTranscribe} recorder={recorder} labels={labels} onRetry={restart} onSubmitted={onSubmitted} />
        </div>
      )}
    </div>
  );
}

function LiveCaption({ text, interim }: { text: string; interim: string }) {
  if (!text && !interim) return null;
  return (
    <p className="rounded border border-border p-3 text-sm text-muted" aria-live="off">
      {text}
      <span className="opacity-60">{interim}</span>
    </p>
  );
}
