/**
 * SM-2 spaced repetition, as used by Anki-style flashcards.
 *
 * The UI offers four grades; they map onto SM-2's 0–5 quality scale. A failed card
 * ("again") restarts its interval but keeps a reduced ease, so hard words come back often.
 */

export type Grade = "again" | "hard" | "good" | "easy";

export interface CardState {
  ease: number;
  /** Days until the next review. */
  interval: number;
  reps: number;
  lapses: number;
  due: Date;
}

const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };
const MIN_EASE = 1.3;
const DAY_MS = 24 * 60 * 60 * 1000;

export function newCard(now: Date): CardState {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now };
}

export function review(card: CardState, grade: Grade, now: Date): CardState {
  const q = QUALITY[grade];
  const ease = Math.max(MIN_EASE, card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (q < 3) {
    // Lapse: see it again in ten minutes-ish (same session), then from day one.
    return { ease, interval: 0, reps: 0, lapses: card.lapses + 1, due: new Date(now.getTime() + 10 * 60 * 1000) };
  }

  const reps = card.reps + 1;
  let interval: number;
  if (reps === 1) interval = grade === "easy" ? 4 : 1;
  else if (reps === 2) interval = grade === "easy" ? 8 : 6;
  else interval = Math.round(card.interval * ease * (grade === "hard" ? 0.8 : grade === "easy" ? 1.3 : 1));

  interval = Math.max(1, interval);
  return { ease, interval, reps, lapses: card.lapses, due: new Date(now.getTime() + interval * DAY_MS) };
}

/** A card counts as learned once it has an interval of three weeks or more. */
export function isMature(card: Pick<CardState, "interval">): boolean {
  return card.interval >= 21;
}
