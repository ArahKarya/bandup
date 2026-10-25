import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card } from "./primitives";

/** Loading placeholder; pair with route-level `loading.tsx`. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Keyboard key, for shortcut hints. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded border border-border bg-surface-2 px-1 font-mono text-[11px] leading-5 text-muted">
      {children}
    </kbd>
  );
}

/** CSS-only tooltip: shows on hover and keyboard focus, no client JS. */
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-fg px-2 py-1 text-xs text-bg opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

interface StatProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  /** Change since the comparison period; sign decides the arrow. */
  delta?: number | null;
  deltaLabel?: string;
}

/** A headline number with an optional icon and trend arrow. */
export function Stat({ label, value, icon, hint, delta, deltaLabel }: StatProps) {
  const Arrow = delta === null || delta === undefined || delta === 0 ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = delta === null || delta === undefined || delta === 0 ? "text-muted" : delta > 0 ? "text-success" : "text-danger";
  return (
    <Card className="flex flex-col gap-1.5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {icon}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      {(delta !== undefined || hint) && (
        <div className="flex items-center gap-1 text-xs">
          {delta !== undefined && delta !== null && (
            <span className={`inline-flex items-center gap-0.5 font-medium ${tone}`}>
              <Arrow size={14} aria-hidden="true" />
              {delta > 0 ? "+" : ""}
              {Number.isInteger(delta) ? delta : delta.toFixed(1)}
            </span>
          )}
          {deltaLabel && <span className="text-muted">{deltaLabel}</span>}
          {hint && <span className="text-muted">{hint}</span>}
        </div>
      )}
    </Card>
  );
}

/** Section heading inside a page, with an optional action link on the right. */
export function SectionHeading({ children, action, icon }: { children: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {icon}
        {children}
      </h2>
      {action}
    </div>
  );
}
