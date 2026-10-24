"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLearner } from "@/lib/server/auth";
import { getContent } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { logStudy } from "@/lib/server/attempts";
import type { Lesson } from "@/lib/content/schema";

const input = z.object({
  lessonId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  /** Chosen option per quiz item; omitted when the learner skipped the quiz. */
  answers: z.array(z.number().int().min(0).max(20)).max(50).optional(),
});

export interface CompleteLessonResult {
  ok: boolean;
  score?: number;
  max?: number;
}

/** Scored on the server so a stored quiz result always matches the lesson's answer key. */
function scoreQuiz(lesson: Lesson, answers: number[]): { score: number; max: number } | null {
  if (lesson.quiz.length === 0 || answers.length !== lesson.quiz.length) return null;
  const score = lesson.quiz.reduce((n, item, i) => n + (answers[i] === item.answer ? 1 : 0), 0);
  return { score, max: lesson.quiz.length };
}

export async function completeLessonAction(raw: unknown): Promise<CompleteLessonResult> {
  const user = await requireLearner();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false };

  const lesson = await getContent("lesson", parsed.data.lessonId);
  if (!lesson) return { ok: false };

  const quiz = parsed.data.answers ? scoreQuiz(lesson, parsed.data.answers) : null;
  const key = { userId_lessonId: { userId: user.id, lessonId: lesson.id } };
  const existing = await db.lessonProgress.findUnique({ where: key, select: { lessonId: true } });

  await db.lessonProgress.upsert({
    where: key,
    create: { userId: user.id, lessonId: lesson.id, quizScore: quiz?.score ?? null, quizMax: quiz?.max ?? null },
    // Re-completing refreshes the date; a skipped quiz keeps the earlier result.
    update: { completedAt: new Date(), ...(quiz ? { quizScore: quiz.score, quizMax: quiz.max } : {}) },
  });

  // Study time is credited once per lesson, so re-reading cannot inflate the log.
  if (!existing) await logStudy(user.id, "lesson", lesson.minutes);

  revalidatePath("/learn");
  revalidatePath(`/learn/${lesson.id}`);
  revalidatePath("/dashboard");
  return { ok: true, ...(quiz ?? {}) };
}
