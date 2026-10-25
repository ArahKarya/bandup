"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { cookies } from "next/headers";
import { requireUser, SESSION_COOKIE } from "@/lib/server/auth";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { removeUserFiles } from "@/lib/server/storage";
import { isLocale } from "@/lib/i18n/dictionaries";

export interface ActionState {
  ok?: boolean;
  error?: string;
}

const profileSchema = z.object({
  module: z.enum(["academic", "general"]),
  targetBand: z.coerce.number().min(4).max(9).multipleOf(0.5),
  examDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null))
    .refine((d) => d === null || !Number.isNaN(d.getTime()), "Invalid date"),
  dailyMinutes: z.coerce.number().int().min(10).max(480),
  studyDays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
});

function parseProfile(form: FormData) {
  return profileSchema.safeParse({
    module: form.get("module"),
    targetBand: form.get("targetBand"),
    examDate: form.get("examDate") || undefined,
    dailyMinutes: form.get("dailyMinutes"),
    studyDays: form.getAll("studyDays"),
  });
}

export async function saveProfileAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseProfile(form);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const firstTime = !user.onboarded;
  await db.profile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data, onboardedAt: new Date() },
    update: { ...parsed.data, ...(firstTime ? { onboardedAt: new Date() } : {}) },
  });

  revalidatePath("/", "layout");
  if (firstTime) redirect("/onboarding/placement");
  return { ok: true };
}

export async function saveLocaleAction(locale: string): Promise<void> {
  const user = await requireUser();
  if (!isLocale(locale)) return;
  await db.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath("/", "layout");
}

const passwordSchema = z.object({
  current: z.string().min(1),
  next: z.string().min(8).max(200),
});

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse({ current: form.get("current"), next: form.get("next") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(parsed.data.current, row.passwordHash))) return { error: "Current password is incorrect." };

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  // A changed password should end every other session (a stolen cookie stops working); keep this one.
  const current = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  await db.session.deleteMany({ where: { userId: user.id, id: { not: current } } });
  return { ok: true };
}

export async function deleteAccountAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  // Re-authenticate: a hijacked session alone must not be enough to destroy an account.
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(String(form.get("password") ?? ""), row.passwordHash))) return { error: "Password is incorrect." };
  if (user.role === "ADMIN" && (await db.user.count({ where: { role: "ADMIN" } })) === 1) {
    return { error: "You are the only admin. Make someone else admin first." };
  }
  await removeUserFiles(user.id);
  await db.user.delete({ where: { id: user.id } });
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
