import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { loginAction } from "@/app/actions/auth";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const { t } = await getDictionary();
  return (
    <AuthForm
      mode="login"
      action={loginAction}
      labels={{
        title: t.auth.login,
        submit: t.auth.login,
        name: t.auth.name,
        email: t.auth.email,
        password: t.auth.password,
        passwordHint: t.auth.passwordHint,
        switchText: t.auth.noAccount,
        switchLink: t.auth.register,
      }}
    />
  );
}
