"use client";

import { Flag } from "lucide-react";

interface FlagToggleProps {
  n: number;
  flagged: boolean;
  onToggle: () => void;
  labels: { flag: string; unflag: string };
}

/** "Review later" toggle under a question number. */
export function FlagToggle({ n, flagged, onToggle, labels }: FlagToggleProps) {
  const label = `${flagged ? labels.unflag : labels.flag} (${n})`;
  return (
    <button
      type="button"
      aria-pressed={flagged}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className={`inline-flex h-6 w-7 items-center justify-center rounded border focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${flagged ? "border-warning bg-warning-soft text-warning" : "border-transparent text-muted hover:border-border hover:text-fg"}`}
    >
      <Flag size={13} aria-hidden="true" className={flagged ? "fill-current" : ""} />
    </button>
  );
}
