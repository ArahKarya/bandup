"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Alert, Button, Textarea } from "@/components/ui";
import type { Recorder } from "./use-recorder";

export interface RecorderLabels {
  record: string;
  stop: string;
  prep: string;
  speak: string;
  micDenied: string;
  transcript: string;
  transcriptHint: string;
  keepAudio: string;
  submit: string;
  autoTranscribe: string;
  error: string;
}

interface SubmitPanelProps {
  taskId: string;
  attemptId?: string;
  canTranscribe: boolean;
  recorder: Recorder;
  labels: RecorderLabels;
  onRetry: () => void;
  /** Called after a successful submission instead of navigating (the mock test refreshes in place). */
  onSubmitted?: (result: { id: string; attemptId: string | null }) => void;
}

/** After recording: listen back, correct the transcript, keep the audio or not, submit. */
export function SubmitPanel({ taskId, attemptId, canTranscribe, recorder, labels, onRetry, onSubmitted }: SubmitPanelProps) {
  const router = useRouter();
  const { blob, transcript, setTranscript, seconds } = recorder;
  const [keep, setKeep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();

  const audioUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  async function autoTranscribe() {
    if (!blob) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "answer.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? labels.error);
      setTranscript(data.text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.error);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("taskId", taskId);
      if (attemptId) fd.append("attemptId", attemptId);
      fd.append("transcript", transcript.trim());
      fd.append("durationSec", String(seconds));
      fd.append("keepAudio", String(keep && Boolean(blob)));
      if (keep && blob) fd.append("audio", blob, "answer.webm");
      const res = await fetch("/api/speaking", { method: "POST", body: fd });
      const data = (await res.json()) as { id?: string; attemptId?: string | null; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? labels.error);
      if (onSubmitted) {
        onSubmitted({ id: data.id, attemptId: data.attemptId ?? null });
        return;
      }
      router.push(data.attemptId ? `/attempt/${data.attemptId}` : `/speaking/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.error);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {audioUrl && <audio controls src={audioUrl} className="w-full" />}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-sm font-medium">
          {labels.transcript}
        </label>
        <Textarea id={fieldId} rows={8} value={transcript} onChange={(e) => setTranscript(e.target.value)} maxLength={20_000} />
        <p className="text-xs text-muted">{labels.transcriptHint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {canTranscribe && blob && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void autoTranscribe()}>
            {labels.autoTranscribe}
          </Button>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="accent-[var(--accent)]" />
          {labels.keepAudio}
        </label>
      </div>
      <div className="flex gap-3">
        <Button type="button" disabled={busy || !transcript.trim()} onClick={() => void submit()}>
          {labels.submit}
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onRetry}>
          <RotateCcw size={16} aria-hidden="true" />
          {labels.record}
        </Button>
      </div>
    </div>
  );
}
