import { newCard, review, type CardState, type Grade } from "./sm2";

type SrsState = Pick<CardState, "ease" | "interval" | "reps" | "lapses">;

/** "10m", "1d", "3w", "2mo": when a card would come back after this grade (Anki-style hint). */
export function nextIntervalLabel(item: { srs?: SrsState }, grade: Grade, now: Date = new Date()): string {
  const card: CardState = item.srs ? { ...item.srs, due: now } : newCard(now);
  const minutes = (review(card, grade, now).due.getTime() - now.getTime()) / 60_000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const days = Math.round(minutes / 1440);
  if (days < 14) return `${days}d`;
  if (days < 60) return `${Math.round(days / 7)}w`;
  return `${Math.round(days / 30)}mo`;
}
