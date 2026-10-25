import Link from "next/link";
import type { ReactNode } from "react";
import { SKILL_META, type SkillKey } from "@/components/ui";

/** Server-rendered filters: every option is a link, so filtering works without JS and is shareable. */

export function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <span className="shrink-0 pt-1 text-xs font-semibold tracking-wider text-muted uppercase sm:w-28">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function Chip({ href, active, children, count }: { href: string; active: boolean; children: ReactNode; count?: number }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-sm transition-colors ${active ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface text-muted hover:border-fg/30 hover:text-fg"}`}
    >
      {children}
      {count !== undefined && <span className="text-xs tabular-nums opacity-70">{count}</span>}
    </Link>
  );
}

export function SkillChip({ href, active, skill, label, count }: { href: string; active: boolean; skill: SkillKey; label: string; count?: number }) {
  const Icon = SKILL_META[skill].icon;
  return (
    <Chip href={href} active={active} count={count}>
      <Icon size={14} className={active ? "" : SKILL_META[skill].text} aria-hidden="true" />
      {label}
    </Chip>
  );
}
