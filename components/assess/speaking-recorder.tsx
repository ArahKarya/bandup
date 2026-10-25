"use client";

import { useEffect, useRef, useState } from "react";
import { Circle, Square } from "lucide-react";
import { Alert, Button, Textarea } from "@/components/ui";
import { formatClock } from "@/lib/exam/navigation";
import { PREP_SEC } from "@/lib/exam/speaking";
import { useRecorder } from "@/components/speaking/use-recorder";
import { SubmitPanel, type RecorderLabels } from "@/components/speaking/submit-panel";

export type { RecorderLabels } from "@/components/speaking/submit-panel";

/**
 * Records a spoken answer freely. Part 2 gets the official minute of preparation and stops at
 * two minutes. Live captions come from the browser's speech recognition where available;
 * the learner can correct the transcript, or transcribe with their own Whisper key.
 */

interface Props {
  taskId: string;
  part: 1 | 2 | 3;
  attemptId?: string;
  canTranscribe: boolean;
  labels: RecorderLabels;
  onSubmitted?: (result: { id: string; attemptId: string | null }) => void;
}

type Phase = "idle" | "prep" | "recording" | "review";

const MAX_SEC = { 1: 300, 2: 120, 3: 360 } as const;

export function SpeakingRecorder({ taskId, part, attemptId, canTranscribe, labels, onSubmitted }: Props) {
  const recorder = useRecorder();
  const { start, stop, seconds: recorded } = recorder;
  const [phase, setPhase] = useState<Phase>("idle");
  const [prepLeft, setPrepLeft] = useState(PREP_SEC);
  const [notes, setNotes] = useState("");

  const startRecording = async () => {
    const ok = await start();
    setPhase(ok ? "recording" : "idle");
  };

  const stopRecording = () => {
    stop();
    setPhase("review");
  };

  // Clock-driven transitions run from timers and read the latest values through a ref.
  const latest = useRef({ recorded, startRecording, stopRecording });
  useEffect(() => {
    latest.current = { recorded, startRecording, stopRecording };
  });

  // Preparation countdown (Part 2), then recording starts on its own.
  useEffect(() => {
    if (phase !== "prep") return;
    const endsAt = performance.now() + PREP_SEC * 1000;
    const t = window.setInterval(() => {
      const left = Math.ceil((endsAt - performance.now()) / 1000);
      setPrepLeft(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(t);
        void latest.current.startRecording();
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [phase]);

  // Recording stops at the part's limit.
  useEffect(() => {
    if (phase !== "recording") return;
    const t = window.setInterval(() => {
      if (latest.current.recorded < MAX_SEC[part]) return;
      window.clearInterval(t);
      latest.current.stopRecording();
    }, 500);
    return () => window.clearInterval(t);
  }, [phase, part]);

  function begin() {
    recorder.reset();
    setPrepLeft(PREP_SEC);
    if (part === 2) setPhase("prep");
    else void startRecording();
  }

  return (
    <div className="flex flex-col gap-4">
      {recorder.micDenied && <Alert tone="danger">{labels.micDenied}</Alert>}

      {phase === "idle" && (
        <div>
          <Button type="button" size="lg" onClick={begin}>
            <Circle size={14} aria-hidden="true" className="fill-current" />
            {labels.record}
          </Button>
        </div>
      )}

      {phase === "prep" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{labels.prep}</span>
            <span className="text-2xl font-semibold tabular-nums" role="timer">
              {formatClock(Math.max(0, prepLeft))}
            </span>
          </div>
          <Textarea rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes…" aria-label="Notes" />
          <div>
            <Button type="button" onClick={() => void startRecording()}>
              {labels.speak}
            </Button>
          </div>
        </div>
      )}

      {phase === "recording" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-sm bg-danger motion-safe:animate-pulse" aria-hidden="true" />
            <span className="text-2xl font-semibold tabular-nums">{formatClock(recorded)}</span>
            <span className="text-sm text-muted">/ {formatClock(MAX_SEC[part])}</span>
            <Button type="button" variant="danger" className="ml-auto" onClick={stopRecording}>
              <Square size={14} aria-hidden="true" className="fill-current" />
              {labels.stop}
            </Button>
          </div>
          {part === 2 && notes && <p className="whitespace-pre-line rounded bg-surface-2 p-3 text-sm">{notes}</p>}
          {(recorder.transcript || recorder.interim) && (
            <p className="rounded border border-border p-3 text-sm text-muted">
              {recorder.transcript}
              <span className="opacity-60">{recorder.interim}</span>
            </p>
          )}
        </div>
      )}

      {phase === "review" && (
        <SubmitPanel taskId={taskId} attemptId={attemptId} canTranscribe={canTranscribe} recorder={recorder} labels={labels} onRetry={begin} onSubmitted={onSubmitted} />
      )}
    </div>
  );
}
