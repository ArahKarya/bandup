"use client";

import { useEffect, useRef, useState } from "react";
import { Hourglass, Play, Volume2 } from "lucide-react";
import type { QuestionSet } from "@/lib/content/schema";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { assetUrl } from "@/lib/content/assets";
import { formatClock } from "@/lib/exam/navigation";
import { fill } from "@/lib/exam/text";
import { Button } from "@/components/ui";
import { pickVoice, speakOnce, useSpeechScript, useVoices } from "./use-speech-script";

type Audio = NonNullable<QuestionSet["audio"]>;

export const PREVIEW_SEC = 30;

interface StrictProps {
  audio: Audio;
  partLabel: string;
  range: { from: number; to: number } | null;
  labels: ExamLabels;
}

type Phase = "ready" | "preview" | "playing" | "done";

/**
 * Exam conditions: a preview countdown ("You now have 30 seconds to look at questions…",
 * also read aloud), then the recording plays once with no pause or scrubbing.
 */
export function StrictListening({ audio, partLabel, range, labels }: StrictProps) {
  const voices = useVoices();
  const [phase, setPhase] = useState<Phase>("ready");
  const [left, setLeft] = useState(PREVIEW_SEC);
  const audioEl = useRef<HTMLAudioElement>(null);
  const speech = useSpeechScript(audio.script, 1);
  const { speakFrom } = speech;

  const previewText = range ? fill(labels.preview, { sec: PREVIEW_SEC, from: range.from, to: range.to }) : "";
  const spokenPreview = range ? `You now have ${PREVIEW_SEC} seconds to look at questions ${range.from} to ${range.to}.` : "";

  useEffect(() => {
    if (phase !== "preview") return;
    const started = performance.now();
    const t = window.setInterval(() => {
      const remaining = PREVIEW_SEC - Math.floor((performance.now() - started) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        window.clearInterval(t);
        setPhase("playing");
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [phase]);

  const begun = useRef(false);
  useEffect(() => {
    if (phase !== "playing" || begun.current) return;
    begun.current = true;
    if (audio.src) void audioEl.current?.play().catch(() => setPhase("done"));
    else speakFrom(0);
  }, [phase, audio.src, speakFrom]);

  // Speech playback reports its own end; the recorded file ends through onEnded.
  const shown: Phase = phase === "playing" && !audio.src && speech.finished ? "done" : phase;

  const start = () => {
    setLeft(PREVIEW_SEC);
    setPhase("preview");
    void speakOnce(spokenPreview, pickVoice(voices, { accent: "en-GB", voice: "female" }));
  };

  return (
    <div className="flex flex-col gap-3">
      {audio.src && <audio ref={audioEl} src={assetUrl(audio.src)} onEnded={() => setPhase("done")} preload="auto" />}
      {shown === "ready" && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={start}>
            <Play size={16} aria-hidden="true" />
            {fill(labels.startPart, { part: partLabel })}
          </Button>
          <p className="text-sm text-muted">{labels.strictNote}</p>
        </div>
      )}
      {shown === "preview" && (
        <div className="flex items-center gap-3 rounded border border-listening bg-listening-soft p-3" role="status" aria-live="polite">
          <Hourglass size={18} aria-hidden="true" className="shrink-0 text-listening" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-listening">{labels.previewTitle}</p>
            <p className="text-sm">{previewText}</p>
          </div>
          <span className="text-2xl font-semibold tabular-nums" aria-hidden="true">
            {formatClock(left)}
          </span>
        </div>
      )}
      {shown === "playing" && (
        <p className="flex items-center gap-2 text-sm" role="status">
          <Volume2 size={16} aria-hidden="true" className="text-listening motion-safe:animate-pulse" />
          {labels.audioPlaying}
          {!audio.src && speech.current !== null && (
            <span className="tabular-nums text-muted">
              {speech.current + 1} / {audio.script.length}
            </span>
          )}
        </p>
      )}
      {shown === "done" && (
        <p className="text-sm text-muted" role="status">
          {labels.audioDone}
        </p>
      )}
    </div>
  );
}
