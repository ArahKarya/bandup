"use client";

import { useActionState } from "react";
import type { AssessState } from "@/app/actions/assess";
import { Alert, Button, Textarea } from "@/components/ui";

interface Props {
  submissionId: string;
  initial: string;
  action: (s: AssessState, f: FormData) => Promise<AssessState>;
  labels: { title: string; hint: string; save: string; saved: string };
}

export function TranscriptForm({ submissionId, initial, action, labels }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="submissionId" value={submissionId} />
      <label htmlFor="transcript" className="font-semibold">{labels.title}</label>
      <Textarea id="transcript" name="transcript" rows={8} defaultValue={initial} maxLength={20_000} />
      <p className="text-xs text-muted">{labels.hint}</p>
      {state.ok && <Alert tone="success">{labels.saved}</Alert>}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <div><Button type="submit" size="sm" variant="secondary" disabled={pending}>{labels.save}</Button></div>
    </form>
  );
}
