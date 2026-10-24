"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "@/app/actions/auth";
import { Alert, Button, Field, Input } from "@/components/ui";

interface Labels {
  title: string;
  submit: string;
  name: string;
  email: string;
  password: string;
  passwordHint: string;
  switchText: string;
  switchLink: string;
}

interface AuthFormProps {
  mode: "login" | "register";
  action: (state: FormState, form: FormData) => Promise<FormState>;
  labels: Labels;
}

export function AuthForm({ mode, action, labels }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{labels.title}</h1>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {mode === "register" && (
        <Field label={labels.name} htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required maxLength={80} />
        </Field>
      )}
      <Field label={labels.email} htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label={labels.password} htmlFor="password" hint={mode === "register" ? labels.passwordHint : undefined}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          required
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {labels.submit}
      </Button>
      <p className="text-sm text-muted">
        {labels.switchText}{" "}
        <Link className="font-medium text-accent hover:underline" href={mode === "login" ? "/register" : "/login"}>
          {labels.switchLink}
        </Link>
      </p>
    </form>
  );
}
