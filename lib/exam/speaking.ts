/** What the simulated Speaking examiner says and how long each answer is expected to take. */

export interface CueCard {
  prompt: string;
  bullets: string[];
  closing: string;
}

/** Indicative answer time per question, in seconds (the examiner moves on around here). */
export const ANSWER_SEC = { 1: 30, 2: 20, 3: 60 } as const;
export const PREP_SEC = 60;
export const LONG_TURN_SEC = 120;

export function part2Intro(card: CueCard): string {
  return [
    "Now I'm going to give you a topic, and I'd like you to talk about it for one to two minutes.",
    "Before you talk, you'll have one minute to think about what you're going to say. You can make some notes if you wish.",
    `Here is your topic. ${card.prompt}`,
    `You should say: ${card.bullets.join("; ")}.`,
    card.closing,
  ].join(" ");
}

export const PART2_START = "All right? Remember you have one to two minutes for this, so don't worry if I stop you. I'll tell you when the time is up. Can you start speaking now, please?";
export const PART2_STOP = "Thank you.";

export function partOpening(part: 1 | 2 | 3, topic: string): string {
  if (part === 1) return `Let's talk about ${topic}.`;
  if (part === 3) return `We've been talking about ${topic}. I'd like to discuss some more general questions related to this.`;
  return "";
}

/** One answer per line, so the transcript reads in question order. */
export function joinAnswers(answers: readonly string[]): string {
  return answers
    .map((a) => a.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** A fallback for browsers whose speech synthesis never fires `end`: about 2.6 words per second. */
export function speechTimeoutMs(text: string, rate = 1): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.round(((words / 2.6) * 1000) / Math.max(0.5, rate)) + 2500;
}
