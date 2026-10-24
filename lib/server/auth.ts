import "server-only";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { Role } from "@/generated/prisma/client";

export const SESSION_COOKIE = "bandup_session";

/** How long a session stays valid. */
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  locale: string;
  onboarded: boolean;
}

const normaliseEmail = (email: string) => email.toLowerCase().trim();

async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.session.create({ data: { id: token, userId, expiresAt } });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Public sign-up is on unless REGISTRATION=closed. A closed instance still accepts the very
 * first account, so a fresh install can always create its admin.
 */
export function registrationOpen(): boolean {
  return process.env.REGISTRATION !== "closed";
}

export async function register(input: { name: string; email: string; password: string; locale: string }): Promise<"ok" | "taken" | "closed"> {
  const email = normaliseEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  // Serializable, so two simultaneous first sign-ups cannot both become admin.
  const outcome = await db.$transaction(
    async (tx) => {
      if (await tx.user.findUnique({ where: { email }, select: { id: true } })) return "taken" as const;
      // The very first account on a fresh install becomes the admin, so self-hosters need no seed step.
      const isFirst = (await tx.user.count()) === 0;
      if (!isFirst && !registrationOpen()) return "closed" as const;
      const user = await tx.user.create({
        data: { email, name: input.name.trim(), passwordHash, role: isFirst ? "ADMIN" : "USER", locale: input.locale, profile: { create: {} } },
      });
      return user.id;
    },
    { isolationLevel: "Serializable" },
  );
  if (outcome === "taken" || outcome === "closed") return outcome;
  await startSession(outcome);
  return "ok";
}

/** Hash of a random password: verifying against it costs the same as a real check. */
const DUMMY_DIGEST = hashPassword(randomBytes(16).toString("hex"));

/** Returns false for both an unknown email and a wrong password, in about the same time. */
export async function login(email: string, password: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { email: normaliseEmail(email) } });
  if (!user) {
    await verifyPassword(password, await DUMMY_DIGEST);
    return false;
  }
  if (!(await verifyPassword(password, user.passwordHash))) return false;
  await startSession(user.id);
  return true;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: token } });
  store.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Cached per render so several components share one query. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { id: token },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, locale: true, profile: { select: { onboardedAt: true } } },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.deleteMany({ where: { id: token } });
    return null;
  }

  const { profile, ...user } = session.user;
  return { ...user, onboarded: Boolean(profile?.onboardedAt) };
});

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** Signed in and through onboarding; otherwise sent to finish it first. */
export async function requireLearner(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
