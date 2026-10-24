"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { login, logout, register } from "@/lib/server/auth";
import { allow, hit } from "@/lib/server/rate-limit";
import { getDictionary, LOCALE_COOKIE } from "@/lib/i18n/server";
import { isLocale } from "@/lib/i18n/dictionaries";

export interface FormState {
  error?: string;
}

const FIFTEEN_MIN = 15 * 60 * 1000;

const credentials = z.object({
  email: z.email().max(200),
  password: z.string().min(8).max(200),
});

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const { t } = await getDictionary();
  const email = String(form.get("email") ?? "").toLowerCase().trim().slice(0, 200);
  // Per address and per account: guessing one password from many IPs is throttled too.
  if (!(await allow("login", 30, FIFTEEN_MIN)) || !hit(`login-account:${email}`, 10, FIFTEEN_MIN)) return { error: t.auth.tooMany };

  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success || !(await login(parsed.data.email, parsed.data.password))) {
    return { error: t.auth.invalid };
  }
  redirect("/dashboard");
}

const registration = credentials.extend({ name: z.string().trim().min(1).max(80) });

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const { t, locale } = await getDictionary();
  if (!(await allow("register", 20, FIFTEEN_MIN))) return { error: t.auth.tooMany };

  const parsed = registration.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.common.error };

  const outcome = await register({ ...parsed.data, locale });
  if (outcome === "taken") return { error: t.auth.taken };
  if (outcome === "closed") return { error: t.auth.closed };
  redirect("/onboarding");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/");
}

/** Language switch for visitors who are not signed in. */
export async function setLocaleCookie(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
