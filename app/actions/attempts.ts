"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLearner } from "@/lib/server/auth";
import { getContent } from "@/lib/server/content";
import { advanceAttempt, currentSectionKind, findOwnAttempt, openAttempt, saveAttempt, PLACEMENT_ID } from "@/lib/server/attempts";
import { parseState } from "@/lib/attempt/sections";
import { awardAchievements } from "@/lib/server/achievements";

const contentId = z.string().regex(/^[a-z0-9-]{1,80}$/);

export async function startPracticeAction(form: FormData): Promise<void> {
  const user = await requireLearner();
  const id = contentId.parse(form.get("contentId"));
  if (!(await getContent("question_set", id))) redirect("/practice");
  const attempt = await openAttempt(user.id, "practice", id);
  redirect(`/attempt/${attempt.id}`);
}

export async function startMockAction(form: FormData): Promise<void> {
  const user = await requireLearner();
  const id = contentId.parse(form.get("contentId"));
  if (!(await getContent("mock_test", id))) redirect("/mock");
  const attempt = await openAttempt(user.id, "mock", id);
  redirect(`/attempt/${attempt.id}`);
}

export async function startPlacementAction(): Promise<void> {
  const user = await requireLearner();
  const attempt = await openAttempt(user.id, "placement", PLACEMENT_ID);
  redirect(`/attempt/${attempt.id}`);
}

const payload = z.object({
  attemptId: z.string().min(1).max(40),
  section: z.number().int().min(0).max(10),
  answers: z.record(z.string(), z.unknown()).optional(),
  essays: z.record(z.string(), z.unknown()).optional(),
  annotations: z.record(z.string(), z.unknown()).optional(),
  flags: z.record(z.string(), z.unknown()).optional(),
});

export interface SaveResult {
  ok: boolean;
  /** The server closed the section (time ran out, or the learner moved on); reload. */
  advanced: boolean;
  savedAt?: string;
}

/** Autosave from the runner. Bodies are capped well below the server-action limit. */
export async function saveAttemptAction(input: unknown): Promise<SaveResult> {
  const user = await requireLearner();
  const parsed = payload.safeParse(input);
  if (!parsed.success) return { ok: false, advanced: false };
  if (JSON.stringify(parsed.data).length > 120_000) return { ok: false, advanced: false };

  const attempt = await findOwnAttempt(user.id, parsed.data.attemptId);
  if (!attempt) return { ok: false, advanced: false };

  const { attempt: saved, stale } = await saveAttempt(attempt.id, parsed.data);
  return { ok: !stale, advanced: stale, savedAt: saved.updatedAt.toISOString() };
}

/** Closes the current section (submit for practice, "next section" for mocks). */
export async function advanceAttemptAction(input: unknown): Promise<{ ok: boolean }> {
  const user = await requireLearner();
  const parsed = payload.safeParse(input);
  if (!parsed.success) return { ok: false };

  const attempt = await findOwnAttempt(user.id, parsed.data.attemptId);
  if (!attempt) return { ok: false };
  // Idempotent: a repeat for a section that already closed is a no-op and the page simply refreshes.
  await advanceAttempt(attempt.id, parsed.data.section, parsed.data);
  await awardAchievements(user.id);
  revalidatePath(`/attempt/${attempt.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Ends a mock test after (or without) the speaking section. */
export async function finishAttemptAction(form: FormData): Promise<void> {
  const user = await requireLearner();
  const attempt = await findOwnAttempt(user.id, String(form.get("attemptId") ?? ""));
  if (!attempt) redirect("/dashboard");
  // Only the untimed Speaking section can be finished this way; earlier sections close through the runner.
  if ((await currentSectionKind(attempt)) === "speaking") {
    await advanceAttempt(attempt.id, parseState(attempt.state).section, {});
    await awardAchievements(user.id);
  }
  redirect(`/attempt/${attempt.id}`);
}
