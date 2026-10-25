"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { QuestionSet } from "@/lib/content/schema";
import type { Annotation } from "@/lib/attempt/sections";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { assetUrl } from "@/lib/content/assets";
import { fill } from "@/lib/exam/text";
import { Button } from "@/components/ui";
import { Annotatable } from "./annotatable";
import { StrictListening } from "./listening-strict";
import { Transcript } from "./transcript";
import { useSpeechScript } from "./use-speech-script";

export { Transcript } from "./transcript";
export { pickVoice } from "./use-speech-script";

type Audio = NonNullable<QuestionSet["audio"]>;

export interface PlayerLabels {
  play: string;
  pause: string;
  replayNote: string;
  transcript: string;
  hideTranscript: string;
  noVoice: string;
}

interface Props {
  audio: Audio;
  /** Exam conditions: preview time, one play-through, no pause, no transcript. */
  strict: boolean;
  labels: PlayerLabels;
  exam: ExamLabels;
  setId: string;
  partLabel: string;
  range: { from: number; to: number } | null;
  annotations: readonly Annotation[];
  onAnnotationsChange: (next: Annotation[]) => void;
}

const SPEEDS = [0.8, 0.9, 1, 1.1, 1.2] as const;

export function ListeningPlayer(props: Props) {
  if (props.strict) return <StrictListening audio={props.audio} partLabel={props.partLabel} range={props.range} labels={props.exam} />;
  return <PracticePlayer {...props} />;
}

function SpeedSelect({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 rounded border border-border bg-surface px-1.5 text-sm text-fg focus:border-accent focus:outline-none"
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s.toFixed(1)}×
          </option>
        ))}
      </select>
    </label>
  );
}

function PracticePlayer({ audio, labels, exam, setId, annotations, onAnnotationsChange }: Props) {
  const [speed, setSpeed] = useState(1);
  const [showTranscript, setShowTranscript] = useState(false);
  const speech = useSpeechScript(audio.script, speed);
  const audioEl = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioEl.current) audioEl.current.playbackRate = speed;
  }, [speed]);

  const useSpeech = !audio.src;
  const noVoice = useSpeech && !speech.hasVoice;

  const transcript = (
    <Annotatable annotations={annotations} onChange={onAnnotationsChange} labels={exam}>
      {(renderText) => (
        <Transcript
          script={audio.script}
          current={useSpeech ? speech.current : null}
          setId={setId}
          renderText={renderText}
          onJump={useSpeech && !noVoice ? (i) => speech.speakFrom(i) : undefined}
          playLabel={(n) => fill(exam.playFromLine, { n })}
        />
      )}
    </Annotatable>
  );

  if (noVoice) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-warning">{labels.noVoice}</p>
        {transcript}
      </div>
    );
  }

  const shown = speech.current ?? (speech.finished ? audio.script.length - 1 : -1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {audio.src ? (
          <audio ref={audioEl} controls src={assetUrl(audio.src)} className="min-w-0 flex-1" onPlay={(e) => (e.currentTarget.playbackRate = speed)} />
        ) : speech.playing ? (
          <Button type="button" variant="secondary" onClick={speech.pause}>
            <Pause size={16} aria-hidden="true" />
            {labels.pause}
          </Button>
        ) : (
          <Button type="button" onClick={() => speech.speakFrom(speech.current ?? 0)}>
            <Play size={16} aria-hidden="true" />
            {labels.play}
          </Button>
        )}
        {useSpeech && !speech.playing && speech.current !== null && (
          <Button type="button" variant="ghost" onClick={() => speech.speakFrom(0)} aria-label="Restart">
            <RotateCcw size={16} aria-hidden="true" />
          </Button>
        )}
        {useSpeech && (
          <span className="text-sm tabular-nums text-muted">
            {shown + 1} / {audio.script.length}
          </span>
        )}
        <SpeedSelect value={speed} onChange={setSpeed} label={exam.speed} />
        <button type="button" className="ml-auto text-sm text-accent hover:underline" aria-expanded={showTranscript} onClick={() => setShowTranscript((s) => !s)}>
          {showTranscript ? labels.hideTranscript : labels.transcript}
        </button>
      </div>
      {useSpeech && (
        <div className="h-1 w-full overflow-hidden rounded-sm bg-surface-2" aria-hidden="true">
          <div className="h-full bg-listening transition-all" style={{ width: `${((shown + 1) / audio.script.length) * 100}%` }} />
        </div>
      )}
      <p className="text-xs text-muted">{labels.replayNote}</p>
      {showTranscript && transcript}
    </div>
  );
}
