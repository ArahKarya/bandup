"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLearner } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getContent } from "@/lib/server/content";
import { hit } from "@/lib/server/rate-limit";
import { countWords } from "@/lib/content/check";
import { ProviderError } from "@/lib/ai/providers";
import { aiScoreSpeaking, aiScoreWriting, logStudy, selfScoreSpeaking, selfScoreWriting } from "@/lib/server/assess";
import { awardAchievements } from "@/lib/server/achievements";

export interface AssessState {
  ok?: boolean;
  error?: string;
}

const id = z.string().min(1).max(40);
const band = z.coerce.number().min(0).max(9).multipleOf(0.5);
const AI_LIMIT_PER_HOUR = 30;

const essay = z.object({
  taskId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  text: z.string().trim().min(1).max(20_000),
  durationSec: z.coerce.number().int().min(0).max(4 * 3600),
});

export async function submitWritingAction(_: AssessState, form: FormData): Promise<AssessState> {
  const user = await requireLearner();
  const parsed = essay.safeParse({ taskId: form.get("taskId"), text: form.get("text"), durationSec: form.get("durationSec") });
  if (!parsed.success) return { error: "Write your answer before submitting." };

  const task = await getContent("writing_task", parsed.data.taskId);
  if (!task) return { error: "This task is no longer available." };

  const sub = await db.writingSubmission.create({
    data: {
      userId: user.id,
      taskId: task.id,
      task: task.task,
      text: parsed.data.text,
      wordCount: countWords(parsed.data.text),
      durationSec: parsed.data.durationSec,
    },
  });
  await logStudy(user.id, "writing", Math.min(parsed.data.durationSec / 60, task.minutes * 1.5));
  redirect(`/writing/${sub.id}`);
}

const writingCriteria = z.object({ ta: band, cc: band, lr: band, gra: band });
const speakingCriteria = z.object({ fc: band, lr: band, gra: band, p: band });

export async function selfScoreWritingAction(_: AssessState, form: FormData): Promise<AssessState> {
  const user = await requireLearner();
  const submissionId = id.parse(form.get("submissionId"));
  const parsed = writingCriteria.safeParse(Object.fromEntries(["ta", "cc", "lr", "gra"].map((k) => [k, form.get(k)])));
  if (!parsed.success) return { error: "Choose a band for each criterion." };
  await selfScoreWriting(user.id, submissionId, parsed.data, String(form.get("notes") ?? "").slice(0, 2000));
  await awardAchievements(user.id);
  revalidatePath(`/writing/${submissionId}`);
  return { ok: true };
}

export async function selfScoreSpeakingAction(_: AssessState, form: FormData): Promise<AssessState> {
  const user = await requireLearner();
  const submissionId = id.parse(form.get("submissionId"));
  const parsed = speakingCriteria.safeParse(Object.fromEntries(["fc", "lr", "gra", "p"].map((k) => [k, form.get(k)])));
  if (!parsed.success) return { error: "Choose a band for each criterion." };
  await selfScoreSpeaking(user.id, submissionId, parsed.data, String(form.get("notes") ?? "").slice(0, 2000));
  await awardAchievements(user.id);
  revalidatePath(`/speaking/${submissionId}`);
  return { ok: true };
}

/** User-facing message for an AI failure; details stay on the server. */
function aiError(e: unknown): string {
  if (e instanceof ProviderError) return e.message;
  if (e instanceof Error && /JSON|Expected|invalid/i.test(e.message)) return "The AI reply could not be read. Please try again.";
  if (e instanceof Error && /No AI key/.test(e.message)) return "Add your AI API key in Settings first.";
  if (e instanceof Error && /transcript/.test(e.message)) return "Add a transcript before asking for AI feedback.";
  return "AI feedback failed. Please try again later.";
}

export async function aiScoreWritingAction(_: AssessState, form: FormData): Promise<AssessState> {
  const user = await requireLearner();
  if (!hit(`ai:${user.id}`, AI_LIMIT_PER_HOUR, 3_600_000)) return { error: "Hourly AI limit reached. Try again later." };
  const submissionId = id.parse(form.get("submissionId"));
  try {
    await aiScoreWriting(user.id, submissionId);
  } catch (e) {
    return { error: aiError(e) };
  }
  await awardAchievements(user.id);
  revalidatePath(`/writing/${submissionId}`);
  return { ok: true };
}

export async function aiScoreSpeakingAction(_: AssessState, form: FormData): Promise<AssessState> {
  const user = await requireLearner();
  if (!hit(`ai:${user.id}`, AI_LIMIT_PER_HOUR, 3_600_000)) return { error: "Hourly AI limit reached. Try again later." };
  const submissionId = id.parse(form.get("submissionId"));
  try {
    await aiScoreSpeaking(user.id, submissionId);
  } catch (e) {
    return { error: aiError(e) };
  }
  await awardAchievements(user.id);
  revalidatePath(`/speaking/${submissionId}`);
  return { ok: true };
}

export async function updateTranscriptAction(_: AssessState, form: FormData): Promise<AssessState> {
  const user = await requireLearner();
  const submissionId = id.parse(form.get("submissionId"));
  const transcript = String(form.get("transcript") ?? "").slice(0, 20_000);
  const { count } = await db.speakingSubmission.updateMany({ where: { id: submissionId, userId: user.id }, data: { transcript } });
  if (count === 0) return { error: "Submission not found." };
  revalidatePath(`/speaking/${submissionId}`);
  return { ok: true };
}
