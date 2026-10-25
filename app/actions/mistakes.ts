"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLearner } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getContent } from "@/lib/server/content";
import { findOwnAttempt, openDrillAttempt } from "@/lib/server/attempts";
import { flash } from "@/lib/server/ui-prefs";
import { getDictionary } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/dictionaries";
import { DRILL_LIMIT, RETRY_LIMIT, TOP_MISSED, pickDrillItems, wrongAnswered } from "@/lib/mistakes/drill";
import { hasQuestion, parseQuestionRef } from "@/lib/mistakes/notebook";
import type { AttemptResult } from "@/lib/attempt/sections";
import { QUESTION_CATEGORIES } from "@/lib/content/schema";
import type { Prisma } from "@/generated/prisma/client";

const cuid = z.string().min(1).max(40).regex(/^[a-z0-9]+$/i);
const skill = z.enum(["listening", "reading", "grammar"]);

const drillForm = z.object({
  mode: z.enum(["selected", "top", "filter"]),
  ids: z.array(cuid).max(500),
  skill: skill.optional(),
  type: z.enum(QUESTION_CATEGORIES).optional(),
});

const blankToUndefined = (v: FormDataEntryValue | null) => (typeof v === "string" && v !== "" ? v : undefined);

/** Opens the drill and redirects to it, or back to `fallback` with a toast when nothing can be drilled. */
async function startDrill(userId: string, items: { setId: string; n: number }[], fallback: string): Promise<never> {
  const { t } = await getDictionary();
  const attempt = items.length ? await openDrillAttempt(userId, items) : null;
  if (!attempt) {
    await flash({ tone: "warning", title: t.mistakes.drillNone });
    redirect(fallback);
  }
  redirect(`/attempt/${attempt.id}`);
}

/** Notifies when the drill holds fewer questions than were asked for. */
async function noteSkipped(skipped: number, picked: { skill: string }[], limit: number): Promise<void> {
  if (skipped <= 0 || picked.length === 0) return;
  const { t } = await getDictionary();
  const mixed = picked.length < limit;
  const title = mixed
    ? fmt(t.mistakes.drillOneSkill, { skill: t.skill[picked[0]!.skill as keyof typeof t.skill] ?? picked[0]!.skill })
    : fmt(t.mistakes.drillCapped, { n: picked.length });
  await flash({ tone: "info", title });
}

/** From the notebook: the selected mistakes, the N most-missed, or everything unmastered in the filter. */
export async function drillMistakesAction(form: FormData): Promise<void> {
  const user = await requireLearner();
  const parsed = drillForm.safeParse({
    mode: form.get("mode"),
    ids: form.getAll("ids").filter((v): v is string => typeof v === "string"),
    skill: blankToUndefined(form.get("skill")),
    type: blankToUndefined(form.get("type")),
  });
  if (!parsed.success) redirect("/mistakes");
  const { mode, ids, skill: skillFilter, type } = parsed.data;

  const where: Prisma.MistakeItemWhereInput =
    mode === "selected"
      ? { userId: user.id, id: { in: ids } }
      : { userId: user.id, mastered: false, ...(skillFilter ? { skill: skillFilter } : {}), ...(type ? { category: type } : {}) };
  const rows = await db.mistakeItem.findMany({
    where,
    select: { setId: true, n: true, skill: true, timesWrong: true, lastDrilledAt: true, createdAt: true },
    take: 500,
  });

  const limit = mode === "top" ? TOP_MISSED : DRILL_LIMIT;
  const { picked, skipped } = pickDrillItems(rows, limit);
  await noteSkipped(skipped, picked, limit);
  await startDrill(user.id, picked, "/mistakes");
}

const retryForm = z.object({ attemptId: cuid, skill: skill.optional() });

/** From the review screen: re-ask the answered-but-wrong questions of a finished attempt. */
export async function retryWrongAction(form: FormData): Promise<void> {
  const user = await requireLearner();
  const parsed = retryForm.safeParse({ attemptId: form.get("attemptId"), skill: blankToUndefined(form.get("skill")) });
  if (!parsed.success) redirect("/dashboard");

  const attempt = await findOwnAttempt(user.id, parsed.data.attemptId);
  if (!attempt) redirect("/dashboard");
  const back = `/attempt/${attempt.id}`;
  if (attempt.status === "in_progress") redirect(back);

  const wrong = wrongAnswered(attempt.result as unknown as AttemptResult | null, parsed.data.skill);
  // One skill per drill: without an explicit skill, the first section with wrong answers.
  const first = wrong[0]?.skill;
  const items = wrong.filter((w) => w.skill === first).slice(0, RETRY_LIMIT);
  await startDrill(user.id, items, back);
}

const bookmarkInput = z.object({
  kind: z.enum(["question", "lesson"]),
  refId: z.string().min(1).max(120),
  note: z.string().trim().max(500).optional(),
});

export interface BookmarkResult {
  ok: boolean;
  bookmarked: boolean;
}

async function refExists(kind: "question" | "lesson", refId: string): Promise<boolean> {
  if (kind === "lesson") return /^[a-z0-9-]{1,80}$/.test(refId) && (await getContent("lesson", refId)) !== null;
  const ref = parseQuestionRef(refId);
  if (!ref) return false;
  const set = await getContent("question_set", ref.setId);
  return set !== null && hasQuestion(set, ref.n);
}

/** Stars or un-stars a question ("<setId>#<n>") or a lesson. Returns the new state. */
export async function toggleBookmarkAction(kind: unknown, refId: unknown, note?: unknown): Promise<BookmarkResult> {
  const user = await requireLearner();
  const parsed = bookmarkInput.safeParse({ kind, refId, note: note ?? undefined });
  if (!parsed.success) return { ok: false, bookmarked: false };
  const input = parsed.data;

  const key = { userId_kind_refId: { userId: user.id, kind: input.kind, refId: input.refId } };
  const existing = await db.bookmark.findUnique({ where: key, select: { id: true } });
  if (existing) {
    await db.bookmark.deleteMany({ where: { id: existing.id, userId: user.id } });
    revalidatePath("/mistakes");
    return { ok: true, bookmarked: false };
  }
  if (!(await refExists(input.kind, input.refId))) return { ok: false, bookmarked: false };
  // upsert: a double click that races past the check above must not fail on the unique key.
  await db.bookmark.upsert({
    where: key,
    create: { userId: user.id, kind: input.kind, refId: input.refId, note: input.note || null },
    update: {},
  });
  revalidatePath("/mistakes");
  return { ok: true, bookmarked: true };
}

const bookmarkDrillForm = z.object({ bookmarkId: cuid.optional() });

/** Drills one bookmarked question, or all of them (most recent first). */
export async function drillBookmarksAction(form: FormData): Promise<void> {
  const user = await requireLearner();
  const parsed = bookmarkDrillForm.safeParse({ bookmarkId: blankToUndefined(form.get("bookmarkId")) });
  if (!parsed.success) redirect("/mistakes?tab=bookmarks");

  const rows = await db.bookmark.findMany({
    where: { userId: user.id, kind: "question", ...(parsed.data.bookmarkId ? { id: parsed.data.bookmarkId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const refs = rows.map((r) => parseQuestionRef(r.refId)).filter((r): r is { setId: string; n: number } => r !== null);
  const sets = new Map((await Promise.all([...new Set(refs.map((r) => r.setId))].map((id) => getContent("question_set", id)))).filter((s) => s !== null).map((s) => [s.id, s]));
  const candidates = refs
    .filter((r) => sets.has(r.setId))
    .map((r, i) => ({ ...r, skill: sets.get(r.setId)!.skill, timesWrong: 0, lastDrilledAt: null, createdAt: new Date(i) }));
  const { picked, skipped } = pickDrillItems(candidates, DRILL_LIMIT);
  await noteSkipped(skipped, picked, DRILL_LIMIT);
  await startDrill(user.id, picked, "/mistakes?tab=bookmarks");
}

const masteredInput = z.object({ id: cuid, mastered: z.boolean() });

/** Manual override: "I've got it" (mastered) or "keep practising" (back to an open mistake). */
export async function setMistakeMasteredAction(id: unknown, mastered: unknown): Promise<{ ok: boolean }> {
  const user = await requireLearner();
  const parsed = masteredInput.safeParse({ id, mastered });
  if (!parsed.success) return { ok: false };
  const { count } = await db.mistakeItem.updateMany({
    where: { id: parsed.data.id, userId: user.id },
    data: parsed.data.mastered ? { mastered: true, masteredAt: new Date() } : { mastered: false, masteredAt: null, correctStreak: 0 },
  });
  if (count > 0) revalidatePath("/mistakes");
  return { ok: count > 0 };
}
