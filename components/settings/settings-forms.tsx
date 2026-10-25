"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeCredentialAction,
  saveCredentialAction,
  testCredentialAction,
  type CredentialState,
} from "@/app/actions/credentials";
import { changePasswordAction, deleteAccountAction, saveLocaleAction, type ActionState } from "@/app/actions/profile";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

export function LocaleForm({ locale, labels }: { locale: string; labels: { language: string } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Field label={labels.language} htmlFor="locale">
      <Select
        id="locale"
        defaultValue={locale}
        disabled={pending}
        onChange={(e) => start(async () => { await saveLocaleAction(e.target.value); router.refresh(); })}
        className="max-w-xs"
      >
        <option value="id">Bahasa Indonesia</option>
        <option value="en">English</option>
      </Select>
    </Field>
  );
}

interface CredentialProps {
  current: { provider: string; model: string; baseUrl: string | null; last4: string } | null;
  defaults: Record<string, string>;
  labels: { provider: string; model: string; apiKey: string; baseUrl: string; save: string; saved: string; remove: string; test: string };
}

export function CredentialForm({ current, defaults, labels }: CredentialProps) {
  const [state, action, pending] = useActionState<CredentialState, FormData>(saveCredentialAction, {});
  const [provider, setProvider] = useState(current?.provider ?? "anthropic");
  const [model, setModel] = useState(current?.model ?? defaults.anthropic);
  const [test, setTest] = useState<CredentialState | null>(null);
  const [testing, startTest] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4">
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        {state.ok && <Alert tone="success">{labels.saved}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.provider} htmlFor="provider">
            <Select
              id="provider"
              name="provider"
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setModel(defaults[e.target.value] ?? "");
              }}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openai">OpenAI-compatible (OpenAI, OpenRouter, Groq, Ollama…)</option>
            </Select>
          </Field>
          <Field label={labels.model} htmlFor="model">
            <Input id="model" name="model" value={model} onChange={(e) => setModel(e.target.value)} required />
          </Field>
        </div>
        <Field label={labels.apiKey} htmlFor="apiKey" hint={current ? `•••• ${current.last4}` : undefined}>
          <Input id="apiKey" name="apiKey" type="password" autoComplete="off" placeholder={current ? "••••••••" : "sk-…"} />
        </Field>
        {provider === "openai" && (
          <Field label={labels.baseUrl} htmlFor="baseUrl">
            <Input id="baseUrl" name="baseUrl" type="url" placeholder="https://api.openai.com/v1" defaultValue={current?.baseUrl ?? ""} />
          </Field>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>{labels.save}</Button>
          {current && (
            <>
              <Button type="button" variant="secondary" disabled={testing} onClick={() => startTest(async () => setTest(await testCredentialAction()))}>
                {labels.test}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void removeCredentialAction()}>
                {labels.remove}
              </Button>
            </>
          )}
        </div>
      </form>
      {test && <Alert tone={test.ok ? "success" : "danger"}>{test.message ?? test.error}</Alert>}
    </div>
  );
}

export function PasswordForm({ labels }: { labels: { current: string; next: string; save: string; saved: string } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="flex max-w-md flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{labels.saved}</Alert>}
      <Field label={labels.current} htmlFor="current">
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label={labels.next} htmlFor="next">
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <div>
        <Button type="submit" variant="secondary" disabled={pending}>{labels.save}</Button>
      </div>
    </form>
  );
}

export function DeleteAccountForm({ labels }: { labels: { title: string; password: string } }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteAccountAction, {});
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label={labels.password} htmlFor="delete-password">
        <Input id="delete-password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <div>
        <Button type="submit" variant="danger" disabled={pending}>{labels.title}</Button>
      </div>
    </form>
  );
}
