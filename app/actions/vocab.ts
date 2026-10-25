"use server";

import { z } from "zod";
import { requireLearner } from "@/lib/server/auth";
import { getContent } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { logStudy } from "@/lib/server/attempts";
import { awardAchievements } from "@/lib/server/achievements";
import { newCard, review, type Grade } from "@/lib/srs/sm2";
import { DAY_MS } from "@/lib/stats/dates";

const slug = z.string().regex(/^[a-z0-9-]{1,80}$/);

const GRADES = ["again", "hard", "good", "easy"] as const satisfies readonly Grade[];

const input = z.object({
  deckId: slug,
  wordId: slug,
  grade: z.enum(GRADES),
});

export interface ReviewResult {
  ok: boolean;
  /** ISO date of the next review, so the client can requeue a lapsed card this session. */
  due?: string;
}

/** A review takes about 15 seconds; logStudy counts whole minutes. */
const REVIEWS_PER_MINUTE = 4;


export async function reviewWordAction(raw: unknown): Promise<ReviewResult> {
  const user = await requireLearner();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const { deckId, wordId, grade } = parsed.data;

  const deck = await getContent("vocab_deck", deckId);
  if (!deck || !deck.words.some((w) => w.id === wordId)) return { ok: false };

  const now = new Date();
  const key = { userId_wordId: { userId: user.id, wordId } };
  const prev = await db.vocabReview.findUnique({ where: key });
  const next = review(prev ?? newCard(now), grade, now);
  const data = { ease: next.ease, interval: next.interval, reps: next.reps, lapses: next.lapses, due: next.due, lastReviewedAt: now };

  await db.vocabReview.upsert({
    where: key,
    create: { userId: user.id, wordId, deckId, ...data },
    update: { deckId, ...data },
  });

  // Credit one minute for every fourth word touched in the last day (~15 s per review).
  const recent = await db.vocabReview.count({ where: { userId: user.id, lastReviewedAt: { gte: new Date(now.getTime() - DAY_MS) } } });
  if (recent % REVIEWS_PER_MINUTE === 1) await logStudy(user.id, "vocab", 1);
  await awardAchievements(user.id);

  return { ok: true, due: next.due.toISOString() };
}
