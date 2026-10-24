"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QuestionSet } from "@/lib/content/schema";
import { assetUrl } from "@/lib/content/assets";
import { Button } from "@/components/ui";

type Audio = NonNullable<QuestionSet["audio"]>;
type Line = Audio["script"][number];

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
  /** Exam conditions: one play-through, no pause, no transcript. */
  strict: boolean;
  labels: PlayerLabels;
}

/** Common female voice names across macOS, Windows, Chrome and Android. */
const FEMALE = /female|woman|samantha|karen|moira|tessa|fiona|victoria|serena|kate|susan|zira|hazel|libby|sonia|natasha|catherine|aria|jenny|google uk english female|veena|allison|ava|nicky/i;
const MALE = /male|man|daniel|alex|fred|oliver|arthur|george|james|lee|tom|david|mark|ryan|guy|william|rishi|aaron|google uk english male/i;

/** Picks a voice for a line: matching accent first, then gender, then any English voice. */
export function pickVoice(voices: SpeechSynthesisVoice[], line: Pick<Line, "accent" | "voice">): SpeechSynthesisVoice | undefined {
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const sameAccent = english.filter((v) => v.lang.replace("_", "-").toLowerCase() === line.accent.toLowerCase());
  const gendered = (list: SpeechSynthesisVoice[]) =>
    list.find((v) => (line.voice === "female" ? FEMALE.test(v.name) && !/\bmale\b/i.test(v.name) : MALE.test(v.name) && !FEMALE.test(v.name)));
  return gendered(sameAccent) ?? sameAccent[0] ?? gendered(english) ?? english[0];
}

function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

export function ListeningPlayer({ audio, strict, labels }: Props) {
  if (audio.src) return <RecordedPlayer src={assetUrl(audio.src)} strict={strict} />;
  return <SpeechPlayer script={audio.script} strict={strict} labels={labels} />;
}

function RecordedPlayer({ src, strict }: { src: string; strict: boolean }) {
  // Native controls in practice; in strict mode only a play button, no scrubbing.
  const ref = useRef<HTMLAudioElement>(null);
  const [started, setStarted] = useState(false);
  if (!strict) return <audio controls src={src} className="w-full" />;
  return (
    <div>
      <audio ref={ref} src={src} />
      <Button type="button" disabled={started} onClick={() => { setStarted(true); void ref.current?.play(); }}>
        ▶
      </Button>
    </div>
  );
}

function SpeechPlayer({ script, strict, labels }: { script: Line[]; strict: boolean; labels: PlayerLabels }) {
  const voices = useVoices();
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const cancelled = useRef(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  useEffect(() => () => {
    cancelled.current = true;
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const speakFrom = useCallback(
    (index: number) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      cancelled.current = false;

      const speak = (i: number) => {
        if (cancelled.current) return;
        if (i >= script.length) {
          setPlaying(false);
          setCurrent(null);
          setFinished(true);
          return;
        }
        const line = script[i];
        const u = new SpeechSynthesisUtterance(line.text);
        const voice = pickVoice(voices, line);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? line.accent;
        u.rate = 0.95;
        // Different speakers sharing one voice are told apart by pitch.
        u.pitch = line.voice === "female" ? 1.1 : 0.9;
        u.onend = () => window.setTimeout(() => speak(i + 1), 350);
        u.onerror = () => speak(i + 1);
        setCurrent(i);
        synth.speak(u);
      };

      setPlaying(true);
      speak(index);
    },
    [script, supported, voices],
  );

  const pause = () => {
    cancelled.current = true;
    window.speechSynthesis.cancel();
    setPlaying(false);
  };

  if (!supported || (voices.length > 0 && !voices.some((v) => v.lang.startsWith("en")))) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-warning">{labels.noVoice}</p>
        <Transcript script={script} current={null} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {playing ? (
          !strict && (
            <Button type="button" variant="secondary" onClick={pause}>
              ❚❚ {labels.pause}
            </Button>
          )
        ) : (
          <Button type="button" disabled={strict && (finished || current !== null)} onClick={() => speakFrom(current ?? 0)}>
            ▶ {labels.play}
          </Button>
        )}
        {!strict && !playing && current !== null && (
          <Button type="button" variant="ghost" onClick={() => speakFrom(0)}>
            ↺
          </Button>
        )}
        <span className="text-sm tabular-nums text-muted">
          {current !== null ? current + 1 : finished ? script.length : 0} / {script.length}
        </span>
        {!strict && (
          <button type="button" className="ml-auto text-sm text-accent hover:underline" onClick={() => setShowTranscript((s) => !s)}>
            {showTranscript ? labels.hideTranscript : labels.transcript}
          </button>
        )}
      </div>
      <div className="h-1 w-full overflow-hidden rounded-sm bg-surface-2">
        <div className="h-full bg-accent transition-all" style={{ width: `${(((current ?? (finished ? script.length : 0)) + (current !== null ? 1 : 0)) / script.length) * 100}%` }} />
      </div>
      {!strict && <p className="text-xs text-muted">{labels.replayNote}</p>}
      {!strict && showTranscript && <Transcript script={script} current={current} onJump={(i) => speakFrom(i)} />}
    </div>
  );
}

export function Transcript({ script, current, onJump }: { script: Line[]; current: number | null; onJump?: (i: number) => void }) {
  return (
    <ol className="max-h-80 overflow-y-auto rounded border border-border bg-surface p-3 text-sm">
      {script.map((line, i) => (
        <li key={i} className={`flex gap-2 rounded px-1 py-0.5 ${current === i ? "bg-accent-soft" : ""}`}>
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
          <button type="button" disabled={!onJump} onClick={() => onJump?.(i)} className="text-left disabled:cursor-text">
            <strong>{line.speaker}:</strong> {line.text}
          </button>
        </li>
      ))}
    </ol>
  );
}
