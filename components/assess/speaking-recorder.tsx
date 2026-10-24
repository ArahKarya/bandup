"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Textarea } from "@/components/ui";

/**
 * Records a spoken answer. Part 2 gets the official minute of preparation and stops at
 * two minutes. Live captions come from the browser's speech recognition where available;
 * the learner can correct the transcript, or transcribe with their own Whisper key.
 */

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

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

interface Props {
  taskId: string;
  part: 1 | 2 | 3;
  attemptId?: string;
  canTranscribe: boolean;
  labels: RecorderLabels;
}

type Phase = "idle" | "prep" | "recording" | "review";

const PREP_SEC = 60;
const MAX_SEC = { 1: 300, 2: 120, 3: 360 } as const;

export function SpeakingRecorder({ taskId, part, attemptId, canTranscribe, labels }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [keep, setKeep] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const duration = useRef(0);

  const audioUrl = blob ? URL.createObjectURL(blob) : null;
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  useEffect(() => () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    recognition.current?.stop();
  }, []);

  // One ticking clock drives both the preparation countdown and the recording limit.
  useEffect(() => {
    if (phase !== "prep" && phase !== "recording") return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === "prep" && seconds >= PREP_SEC) void startRecording();
    if (phase === "recording" && seconds >= MAX_SEC[part]) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the clock should trigger these transitions
  }, [seconds, phase]);

  async function startRecording() {
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(labels.micDenied);
      setPhase("idle");
      return;
    }
    chunks.current = [];
    const rec = new MediaRecorder(stream.current);
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    rec.onstop = () => {
      setBlob(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
      stream.current?.getTracks().forEach((t) => t.stop());
    };
    rec.start(1000);
    recorder.current = rec;

    const Ctor = recognitionCtor();
    if (Ctor) {
      const r = new Ctor();
      r.lang = "en-GB";
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        let finalText = "";
        let pending = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += `${res[0].transcript.trim()} `;
          else pending += res[0].transcript;
        }
        if (finalText) setTranscript((prev) => `${prev}${finalText}`);
        setInterim(pending);
      };
      // Chrome ends recognition after silence; restart while still recording.
      r.onend = () => {
        if (recorder.current?.state === "recording") {
          try {
            r.start();
          } catch {
            // already started
          }
        }
      };
      r.onerror = () => undefined;
      try {
        r.start();
        recognition.current = r;
      } catch {
        recognition.current = null;
      }
    }

    startedAt.current = Date.now();
    setSeconds(0);
    setPhase("recording");
  }

  function stopRecording() {
    duration.current = Math.round((Date.now() - startedAt.current) / 1000);
    const r = recognition.current;
    recognition.current = null;
    r?.stop();
    if (recorder.current?.state === "recording") recorder.current.stop();
    setInterim("");
    setPhase("review");
  }

  function begin() {
    setSeconds(0);
    setTranscript("");
    setBlob(null);
    if (part === 2) setPhase("prep");
    else void startRecording();
  }

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
      fd.append("durationSec", String(duration.current));
      fd.append("keepAudio", String(keep && Boolean(blob)));
      if (keep && blob) fd.append("audio", blob, "answer.webm");
      const res = await fetch("/api/speaking", { method: "POST", body: fd });
      const data = (await res.json()) as { id?: string; attemptId?: string | null; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? labels.error);
      router.push(data.attemptId ? `/attempt/${data.attemptId}` : `/speaking/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.error);
      setBusy(false);
    }
  }

  const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}

      {phase === "idle" && (
        <div>
          <Button type="button" size="lg" onClick={begin}>
            ● {labels.record}
          </Button>
        </div>
      )}

      {phase === "prep" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{labels.prep}</span>
            <span className="text-2xl font-semibold tabular-nums">{clock(Math.max(0, PREP_SEC - seconds))}</span>
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
            <span className="h-3 w-3 animate-pulse rounded-sm bg-danger" aria-hidden="true" />
            <span className="text-2xl font-semibold tabular-nums">{clock(seconds)}</span>
            <span className="text-sm text-muted">/ {clock(MAX_SEC[part])}</span>
            <Button type="button" variant="danger" className="ml-auto" onClick={stopRecording}>
              ■ {labels.stop}
            </Button>
          </div>
          {part === 2 && notes && <p className="whitespace-pre-line rounded bg-surface-2 p-3 text-sm">{notes}</p>}
          {(transcript || interim) && (
            <p className="rounded border border-border p-3 text-sm text-muted">
              {transcript}
              <span className="opacity-60">{interim}</span>
            </p>
          )}
        </div>
      )}

      {phase === "review" && (
        <div className="flex flex-col gap-4">
          {audioUrl && <audio controls src={audioUrl} className="w-full" />}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="transcript" className="text-sm font-medium">
              {labels.transcript}
            </label>
            <Textarea id="transcript" rows={8} value={transcript} onChange={(e) => setTranscript(e.target.value)} maxLength={20_000} />
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
            <Button type="button" variant="ghost" disabled={busy} onClick={begin}>
              ↺ {labels.record}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
