import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/** Small shared primitives. Corners stay at 4px; nothing is pill-shaped. */

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover border border-transparent",
  secondary: "bg-surface text-fg border border-border hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2 border border-transparent",
  danger: "bg-danger text-white hover:opacity-90 border border-transparent",
};

const SIZES = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base" } as const;

export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md"): string {
  return `inline-flex items-center justify-center gap-2 rounded font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]}`;
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: keyof typeof SIZES;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  return <button className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: keyof typeof SIZES;
}

export function LinkButton({ variant = "primary", size = "md", className = "", ...props }: LinkButtonProps) {
  return <Link className={`${buttonClass(variant, size)} ${className}`} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded border border-border bg-surface ${className}`} {...props} />;
}

type Tone = "neutral" | "accent" | "success" | "danger" | "warning";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
};

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${inputClass} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={`w-full rounded border border-border bg-surface p-3 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function ProgressBar({ value, max = 1, className = "" }: { value: number; max?: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-sm bg-surface-2 ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A band score; tone shows where it sits against the target. */
export function BandValue({ band, target, size = "md" }: { band: number | null | undefined; target?: number; size?: "md" | "lg" }) {
  const text = band === null || band === undefined ? "—" : band.toFixed(1);
  const tone = band === null || band === undefined || target === undefined ? "text-fg" : band >= target ? "text-success" : band >= target - 0.5 ? "text-warning" : "text-danger";
  return <span className={`font-semibold tabular-nums ${size === "lg" ? "text-3xl" : "text-xl"} ${tone}`}>{text}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded border border-dashed border-border p-8 text-center text-muted">{children}</div>;
}

export function Alert({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`rounded px-3 py-2 text-sm ${TONES[tone]}`}>{children}</div>;
}
