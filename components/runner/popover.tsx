"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface PopoverProps {
  /** Button content (icon + label). */
  trigger: ReactNode;
  /** Accessible name of the trigger and the dialog. */
  label: string;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}

/** A small disclosure panel: closes on Escape and on clicks outside, returns focus to its button. */
export function Popover({ trigger, label, children, align = "right", className = "" }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-8 items-center gap-1.5 rounded border border-border px-2 text-sm text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${open ? "bg-surface-2" : "bg-surface"}`}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={`animate-rise absolute top-full z-40 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded border border-border bg-surface p-4 text-sm shadow-pop ${align === "right" ? "right-0" : "left-0"} ${className}`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
