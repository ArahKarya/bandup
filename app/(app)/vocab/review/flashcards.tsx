"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { reviewWordAction } from "@/app/actions/vocab";
import { Alert, Badge, Button, Card, ProgressBar } from "@/components/ui";
import type { Grade } from "@/lib/srs/sm2";

export interface FlashcardItem {
  deckId: string;
  wordId: string;
  word: string;
  pos: string;
  level: string;
  definition: string;
  translation: string | null;
  example: string;
  collocations: string[];
  synonyms: string[];
}

export interface FlashcardLabels {
  show: string;
  grades: Record<Grade, string>;
  listen: string;
  translation: string;
  example: string;
  collocations: string;
  synonyms: string;
  remaining: string;
  error: string;
}

interface Props {
  items: FlashcardItem[];
  labels: FlashcardLabels;
  /** Shown once the queue is empty; rendered by the server page. */
  doneSlot: ReactNode;
}

const GRADES: readonly Grade[] = ["again", "hard", "good", "easy"];
const GRADE_VARIANT: Record<Grade, "danger" | "secondary" | "primary"> = {
  again: "danger",
  hard: "secondary",
  good: "primary",
  easy: "secondary",
};

const noopSubscribe = () => () => {};

/** speechSynthesis only exists in the browser; reading it this way avoids a hydration mismatch. */
function useCanSpeak(): boolean {
  return useSyncExternalStore(noopSubscribe, () => "speechSynthesis" in window, () => false);
}

function speak(text: string): void {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang === "en-GB");
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * The review session. Grading moves on straight away and saves in the background, so a slow
 * connection never holds the learner up; a lapsed card goes to the back of the queue.
 */
export function Flashcards({ items, labels, doneSlot }: Props) {
  const [queue, setQueue] = useState<FlashcardItem[]>(items);
  const [flipped, setFlipped] = useState(false);
  const [failed, setFailed] = useState(false);
  const [, start] = useTransition();
  const canSpeak = useCanSpeak();

  const card = queue[0];

  const grade = useCallback(
    (g: Grade) => {
      if (!card) return;
      setQueue((prev) => (g === "again" ? [...prev.slice(1), prev[0]] : prev.slice(1)));
      setFlipped(false);
      start(async () => {
        const res = await reviewWordAction({ deckId: card.deckId, wordId: card.wordId, grade: g });
        if (!res.ok) setFailed(true);
      });
    },
    [card],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      const index = ["1", "2", "3", "4"].indexOf(e.key);
      if (index >= 0 && flipped) grade(GRADES[index]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, flipped, grade]);

  if (!card) return <>{doneSlot}</>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-sm text-muted">
        <ProgressBar value={items.length - queue.length} max={items.length} className="flex-1" />
        <span className="tabular-nums" aria-live="polite">
          {queue.length} {labels.remaining}
        </span>
      </div>
      {failed && <Alert tone="danger">{labels.error}</Alert>}

      <Card className="p-6 sm:p-8">
        <CardFront card={card} canSpeak={canSpeak} listenLabel={labels.listen} />
        {flipped && <CardBack card={card} labels={labels} />}
      </Card>

      {flipped ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Grade">
          {GRADES.map((g, i) => (
            <Button key={g} variant={GRADE_VARIANT[g]} size="lg" onClick={() => grade(g)} aria-keyshortcuts={String(i + 1)}>
              {labels.grades[g]}
              <kbd className="text-xs opacity-70">{i + 1}</kbd>
            </Button>
          ))}
        </div>
      ) : (
        <Button size="lg" onClick={() => setFlipped(true)} aria-keyshortcuts="Space">
          {labels.show}
        </Button>
      )}
    </div>
  );
}

function CardFront({ card, canSpeak, listenLabel }: { card: FlashcardItem; canSpeak: boolean; listenLabel: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex items-center gap-2">
        <h2 className="text-3xl font-semibold tracking-tight">{card.word}</h2>
        {canSpeak && (
          <Button variant="ghost" size="sm" onClick={() => speak(card.word)} aria-label={`${listenLabel}: ${card.word}`}>
            <SpeakerIcon />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="italic">{card.pos}</span>
        <Badge tone="accent">{card.level}</Badge>
      </div>
    </div>
  );
}

function CardBack({ card, labels }: { card: FlashcardItem; labels: FlashcardLabels }) {
  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-border pt-6 text-sm">
      <p className="text-base">{card.definition}</p>
      <dl className="flex flex-col gap-3">
      {card.translation && <Row label={labels.translation}>{card.translation}</Row>}
      <Row label={labels.example}>
        <span className="italic">“{card.example}”</span>
      </Row>
      {card.collocations.length > 0 && <Row label={labels.collocations}>{card.collocations.join(" · ")}</Row>}
      {card.synonyms.length > 0 && <Row label={labels.synonyms}>{card.synonyms.join(", ")}</Row>}
      </dl>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
