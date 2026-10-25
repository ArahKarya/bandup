"use client";

import { useActionState } from "react";
import type { AdminActionState, AdminError } from "@/app/actions/admin";
import { Button } from "@/components/ui";

interface ActionButtonProps {
  action: (state: AdminActionState, form: FormData) => Promise<AdminActionState>;
  /** Hidden fields posted with the button. */
  fields: Record<string, string>;
  label: string;
  errors: Record<AdminError, string>;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  /** Screen-reader context, e.g. "Make admin: Jane Doe". */
  ariaLabel?: string;
}

/** A one-click server action with its own pending and error state. */
export function ActionButton({ action, fields, label, errors, variant = "secondary", disabled, ariaLabel }: ActionButtonProps) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button type="submit" size="sm" variant={variant} disabled={disabled || pending} aria-label={ariaLabel}>
        {label}
      </Button>
      {state.error && (
        <p role="alert" className="max-w-48 text-right text-xs text-danger">
          {errors[state.error]}
        </p>
      )}
    </form>
  );
}
