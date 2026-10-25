"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone recording with live captions from the browser's speech recognition (where
 * available). One recording can be paused while the examiner speaks and resumed for the
 * next answer, so a whole Speaking part ends up in one file and one transcript.
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

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [micDenied, setMicDenied] = useState(false);

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const chunks = useRef<Blob[]>([]);
  /** While true, speech recognition results are ignored (examiner talking, or paused). */
  const muted = useRef(false);
  const live = useRef(false);

  useEffect(
    () => () => {
      live.current = false;
      recognition.current?.stop();
      if (recorder.current?.state !== "inactive") recorder.current?.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  // Only time actually spent answering is counted.
  useEffect(() => {
    if (state !== "recording") return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [state]);

  const startRecognition = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-GB";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      if (muted.current) return;
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
    // Chrome ends recognition after silence; restart while the recording is live.
    r.onend = () => {
      if (!live.current) return;
      try {
        r.start();
      } catch {
        // already started
      }
    };
    r.onerror = () => undefined;
    try {
      r.start();
      recognition.current = r;
    } catch {
      recognition.current = null;
    }
  }, []);

  /** Asks for the microphone and starts recording; false if access was denied. */
  const start = useCallback(async (): Promise<boolean> => {
    setMicDenied(false);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicDenied(true);
      return false;
    }
    chunks.current = [];
    const rec = new MediaRecorder(stream.current);
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      setBlob(new Blob(chunks.current, { type: rec.mimeType || "audio/webm" }));
      stream.current?.getTracks().forEach((t) => t.stop());
    };
    rec.start(1000);
    recorder.current = rec;
    live.current = true;
    muted.current = false;
    startRecognition();
    setBlob(null);
    setTranscript("");
    setSeconds(0);
    setState("recording");
    return true;
  }, [startRecognition]);

  const pause = useCallback(() => {
    muted.current = true;
    setInterim("");
    if (recorder.current?.state === "recording") recorder.current.pause();
    setState((s) => (s === "recording" ? "paused" : s));
  }, []);

  /** Resumes after a pause; `newAnswer` starts a new transcript line. */
  const resume = useCallback((newAnswer = true) => {
    if (newAnswer) setTranscript((prev) => (prev.trim() ? `${prev.trimEnd()}\n` : prev));
    muted.current = false;
    if (recorder.current?.state === "paused") recorder.current.resume();
    setState((s) => (s === "paused" ? "recording" : s));
  }, []);

  const stop = useCallback(() => {
    live.current = false;
    muted.current = true;
    const r = recognition.current;
    recognition.current = null;
    r?.stop();
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    setInterim("");
    setState("stopped");
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setSeconds(0);
    setTranscript("");
    setBlob(null);
  }, []);

  return { state, seconds, transcript, setTranscript, interim, blob, micDenied, start, pause, resume, stop, reset };
}

export type Recorder = ReturnType<typeof useRecorder>;
