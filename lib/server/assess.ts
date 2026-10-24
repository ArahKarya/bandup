import "server-only";

import { db } from "./db";
import { getContent } from "./content";
import { logStudy } from "./attempts";
import { mockBands } from "./mock-bands";
import { decryptSecret } from "@/lib/crypto/secret";
import { complete, type Provider, type ProviderConfig } from "@/lib/ai/providers";
import { speakingPrompt, writingPrompt } from "@/lib/ai/prompts";
import { parseSpeaking, parseWriting } from "@/lib/ai/parse";
import { speakingBand, taskBand, type SpeakingCriteria, type WritingCriteria } from "@/lib/scoring/band";
import type { Prisma } from "@/generated/prisma/client";

/** Scoring of Writing and Speaking submissions, by the learner or by their own AI key. */

export function encryptionKey(): string {
  const key = process.env.APP_ENCRYPTION_KEY;
  if (!key) throw new Error("APP_ENCRYPTION_KEY is not set — AI keys cannot be stored or used.");
  return key;
}

export async function providerConfig(userId: string): Promise<ProviderConfig | null> {
  const cred = await db.apiCredential.findUnique({ where: { userId } });
  if (!cred) return null;
  return {
    provider: cred.provider as Provider,
    model: cred.model,
    baseUrl: cred.baseUrl,
    apiKey: decryptSecret(cred.ciphertext, encryptionKey()),
  };
}

/**
 * Updates the learner's Writing/Speaking band timeline. A practice task contributes its
 * own band; a mock test contributes once both tasks (or all parts) are scored.
 */
async function recordProductive(
  userId: string,
  skill: "writing" | "speaking",
  band: number,
  sub: { id: string; attemptId: string | null },
): Promise<void> {
  if (!sub.attemptId) {
    await db.$transaction([
      db.skillScore.deleteMany({ where: { userId, submissionId: sub.id } }),
      db.skillScore.create({ data: { userId, skill, band, source: "practice", submissionId: sub.id } }),
    ]);
    return;
  }
  const attempt = await db.attempt.findFirst({ where: { id: sub.attemptId, userId } });
  if (!attempt) return;
  const bands = await mockBands(attempt.id, attempt.bands);
  // Keep the attempt's stored bands current so history shows the overall once it exists.
  await db.attempt.update({
    where: { id: attempt.id },
    data: { bands: { ...((attempt.bands as Record<string, unknown> | null) ?? {}), writing: bands.writing, speaking: bands.speaking, overall: bands.overall } },
  });
  const value = bands[skill];
  if (value === null) return;
  await db.$transaction([
    db.skillScore.deleteMany({ where: { userId, attemptId: attempt.id, skill } }),
    db.skillScore.create({ data: { userId, skill, band: value, source: attempt.mode, attemptId: attempt.id } }),
  ]);
}

async function ownWriting(userId: string, submissionId: string) {
  const sub = await db.writingSubmission.findFirst({ where: { id: submissionId, userId } });
  if (!sub) throw new Error("Submission not found");
  return sub;
}

async function ownSpeaking(userId: string, submissionId: string) {
  const sub = await db.speakingSubmission.findFirst({ where: { id: submissionId, userId } });
  if (!sub) throw new Error("Submission not found");
  return sub;
}

export async function selfScoreWriting(userId: string, submissionId: string, criteria: WritingCriteria, notes: string): Promise<void> {
  const sub = await ownWriting(userId, submissionId);
  const band = taskBand(criteria);
  await db.writingScore.create({
    data: { submissionId: sub.id, source: "self", criteria: { ...criteria }, band, feedback: notes ? { notes } : undefined },
  });
  await recordProductive(userId, "writing", band, sub);
}

export async function aiScoreWriting(userId: string, submissionId: string): Promise<void> {
  const sub = await ownWriting(userId, submissionId);
  const config = await providerConfig(userId);
  if (!config) throw new Error("No AI key configured");
  const task = await getContent("writing_task", sub.taskId);
  if (!task) throw new Error("Task not found");

  const reply = await complete(config, writingPrompt(task, sub.text, sub.wordCount));
  const result = parseWriting(reply);
  const band = taskBand(result.criteria);
  const { criteria, ...feedback } = result;
  await db.writingScore.create({
    data: { submissionId: sub.id, source: "ai", criteria: { ...criteria }, band, feedback: feedback as Prisma.InputJsonValue, model: config.model },
  });
  await recordProductive(userId, "writing", band, sub);
}

export async function selfScoreSpeaking(userId: string, submissionId: string, criteria: SpeakingCriteria, notes: string): Promise<void> {
  const sub = await ownSpeaking(userId, submissionId);
  const band = speakingBand(criteria);
  await db.speakingScore.create({
    data: { submissionId: sub.id, source: "self", criteria: { ...criteria }, band, feedback: notes ? { notes } : undefined },
  });
  await recordProductive(userId, "speaking", band, sub);
}

export async function aiScoreSpeaking(userId: string, submissionId: string): Promise<void> {
  const sub = await ownSpeaking(userId, submissionId);
  const config = await providerConfig(userId);
  if (!config) throw new Error("No AI key configured");
  const task = await getContent("speaking_task", sub.taskId);
  if (!task) throw new Error("Task not found");
  if (!sub.transcript.trim()) throw new Error("The transcript is empty");

  const reply = await complete(config, speakingPrompt(task, sub.transcript, sub.durationSec));
  const result = parseSpeaking(reply);
  const band = speakingBand(result.criteria);
  const { criteria, ...feedback } = result;
  await db.speakingScore.create({
    data: { submissionId: sub.id, source: "ai", criteria: { ...criteria }, band, feedback: feedback as Prisma.InputJsonValue, model: config.model },
  });
  await recordProductive(userId, "speaking", band, sub);
}

export { logStudy };
