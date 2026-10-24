import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { registerAction } from "@/app/actions/auth";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage() {
  const { t } = await getDictionary();
  return (
    <AuthForm
      mode="register"
      action={registerAction}
      labels={{
        title: t.auth.register,
        submit: t.auth.register,
        name: t.auth.name,
        email: t.auth.email,
        password: t.auth.password,
        passwordHint: t.auth.passwordHint,
        switchText: t.auth.haveAccount,
        switchLink: t.auth.login,
      }}
    />
  );
}
