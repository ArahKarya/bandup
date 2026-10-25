"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { QuestionSet } from "@/lib/content/schema";
import { speechTimeoutMs } from "@/lib/exam/speaking";

type Line = NonNullable<QuestionSet["audio"]>["script"][number];

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

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

const noSubscribe = () => () => undefined;

/**
 * Speech synthesis support for rendering. The server snapshot says "supported" so the first
 * client render matches the HTML; the real value follows right after hydration.
 */
export function useSpeechSupported(): boolean {
  return useSyncExternalStore(noSubscribe, speechSupported, () => true);
}

export function useVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!speechSupported()) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);
  return voices;
}

/**
 * Speaks one piece of text and resolves when it ends (or after a timeout, since some
 * browsers never fire `end`). Resolves at once without speech synthesis.
 */
export function speakOnce(text: string, voice: SpeechSynthesisVoice | undefined, rate = 0.95): Promise<void> {
  if (!speechSupported() || !text.trim()) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-GB";
    u.rate = rate;
    u.onend = finish;
    u.onerror = finish;
    const timer = window.setTimeout(finish, speechTimeoutMs(text, rate));
    window.speechSynthesis.speak(u);
  });
}

/** Plays a listening script line by line through speech synthesis. */
export function useSpeechScript(script: readonly Line[], speed: number) {
  const voices = useVoices();
  const [current, setCurrent] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const run = useRef(0);
  const supported = useSpeechSupported();
  const hasVoice = supported && (voices.length === 0 || voices.some((v) => v.lang.toLowerCase().startsWith("en")));

  useEffect(
    () => () => {
      run.current++;
      if (speechSupported()) window.speechSynthesis.cancel();
    },
    [],
  );

  const speakFrom = useCallback(
    (index: number) => {
      if (!supported) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      const token = ++run.current;

      const speak = (i: number) => {
        if (run.current !== token) return;
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
        u.rate = 0.95 * speed;
        // Different speakers sharing one voice are told apart by pitch.
        u.pitch = line.voice === "female" ? 1.1 : 0.9;
        u.onend = () => window.setTimeout(() => speak(i + 1), 350 / speed);
        u.onerror = () => speak(i + 1);
        setCurrent(i);
        synth.speak(u);
      };

      setPlaying(true);
      setFinished(false);
      speak(index);
    },
    [script, supported, voices, speed],
  );

  const pause = useCallback(() => {
    run.current++;
    window.speechSynthesis.cancel();
    setPlaying(false);
  }, []);

  return { voices, supported, hasVoice, current, playing, finished, speakFrom, pause };
}
