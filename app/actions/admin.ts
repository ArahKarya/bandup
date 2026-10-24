"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/auth";
import { checkRoleChange } from "@/lib/stats/role-rules";
import { Prisma } from "@/generated/prisma/client";

/** Postgres serialization failure surfaced by Prisma; anything else is a real error. */
const isWriteConflict = (e: unknown): boolean => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";

/** Error codes map to `t.admin.errors`; the UI translates them. */
export type AdminError = "self" | "lastAdmin" | "notFound" | "invalid" | "conflict";

export interface AdminActionState {
  ok?: boolean;
  error?: AdminError;
}

const roleSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(["USER", "ADMIN"]),
});

export async function setRoleAction(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const parsed = roleSchema.safeParse({ userId: form.get("userId"), role: form.get("role") });
  if (!parsed.success) return { error: "invalid" };
  const { userId, role } = parsed.data;

  // Serializable so two admins demoting each other at once cannot both pass the count check;
  // the loser of that race gets a serialization failure and is asked to retry.
  const verdict = await db
    .$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (!target) return "notFound" as const;
        const adminCount = await tx.user.count({ where: { role: "ADMIN" } });
        const check = checkRoleChange({ actorId: admin.id, targetId: userId, currentRole: target.role, nextRole: role, adminCount });
        if (check === "ok") await tx.user.update({ where: { id: userId }, data: { role } });
        return check;
      },
      { isolationLevel: "Serializable" },
    )
    .catch((e: unknown) => {
      if (isWriteConflict(e)) return "conflict" as const;
      throw e;
    });

  if (verdict === "conflict") return { error: "conflict" };
  if (verdict === "notFound") return { error: "notFound" };
  if (verdict === "self") return { error: "self" };
  if (verdict === "last_admin") return { error: "lastAdmin" };
  revalidatePath("/admin/users");
  return { ok: true };
}

const publishSchema = z.object({
  contentId: z.string().min(1).max(200),
  published: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function setPublishedAction(_: AdminActionState, form: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const parsed = publishSchema.safeParse({ contentId: form.get("contentId"), published: form.get("published") });
  if (!parsed.success) return { error: "invalid" };

  const { count } = await db.contentItem.updateMany({ where: { id: parsed.data.contentId }, data: { published: parsed.data.published } });
  if (count === 0) return { error: "notFound" };
  // Learner-facing lists read published content, so every layout below the root is stale.
  revalidatePath("/", "layout");
  return { ok: true };
}
