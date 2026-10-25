import type { ReactNode } from "react";

/**
 * Empty states with a small line illustration, so a fresh account looks inviting rather
 * than broken. The drawings are inline SVG in the theme colours (no image files).
 */

export type Illustration = "chart" | "books" | "target" | "inbox" | "mic" | "pencil" | "trophy" | "notebook";

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Drawing({ kind }: { kind: Illustration }) {
  switch (kind) {
    case "chart":
      return (
        <>
          <path d="M14 70h84" {...STROKE} />
          <rect x="22" y="44" width="12" height="26" rx="2" fill="var(--accent-soft)" stroke="currentColor" strokeWidth="2" />
          <rect x="42" y="30" width="12" height="40" rx="2" fill="var(--accent-soft)" stroke="currentColor" strokeWidth="2" />
          <rect x="62" y="52" width="12" height="18" rx="2" fill="var(--accent-soft)" stroke="currentColor" strokeWidth="2" />
          <path d="M20 38l20-12 20 14 24-20" {...STROKE} stroke="var(--accent)" strokeDasharray="4 4" />
          <circle cx="84" cy="20" r="4" fill="var(--accent)" />
        </>
      );
    case "books":
      return (
        <>
          <rect x="20" y="22" width="16" height="48" rx="2" fill="var(--reading-soft)" stroke="currentColor" strokeWidth="2" />
          <rect x="38" y="16" width="16" height="54" rx="2" fill="var(--listening-soft)" stroke="currentColor" strokeWidth="2" />
          <rect x="58" y="26" width="16" height="46" rx="2" transform="rotate(-12 66 49)" fill="var(--writing-soft)" stroke="currentColor" strokeWidth="2" />
          <path d="M14 72h84" {...STROKE} />
        </>
      );
    case "target":
      return (
        <>
          <circle cx="56" cy="44" r="28" fill="var(--accent-soft)" stroke="currentColor" strokeWidth="2" />
          <circle cx="56" cy="44" r="17" {...STROKE} />
          <circle cx="56" cy="44" r="6" fill="var(--accent)" />
          <path d="M56 44l26-24M76 20h8v8" {...STROKE} />
        </>
      );
    case "inbox":
      return (
        <>
          <path d="M22 46l10-24h48l10 24v22H22z" fill="var(--surface-2)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d="M22 46h22l4 8h16l4-8h22" {...STROKE} />
        </>
      );
    case "mic":
      return (
        <>
          <rect x="46" y="14" width="20" height="36" rx="10" fill="var(--speaking-soft)" stroke="currentColor" strokeWidth="2" />
          <path d="M36 42a20 20 0 0 0 40 0M56 62v10M44 72h24" {...STROKE} />
          <path d="M84 30c4 4 4 16 0 20M90 24c7 8 7 24 0 32" {...STROKE} stroke="var(--speaking)" />
        </>
      );
    case "pencil":
      return (
        <>
          <rect x="18" y="16" width="56" height="60" rx="2" fill="var(--surface-2)" stroke="currentColor" strokeWidth="2" />
          <path d="M28 30h36M28 40h36M28 50h22" {...STROKE} />
          <path d="M66 62l24-24 6 6-24 24-8 2z" fill="var(--writing-soft)" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </>
      );
    case "trophy":
      return (
        <>
          <path d="M40 18h32v18a16 16 0 0 1-32 0z" fill="var(--warning-soft)" stroke="currentColor" strokeWidth="2" />
          <path d="M40 24H30a8 8 0 0 0 10 14M72 24h10a8 8 0 0 1-10 14M56 52v10M44 72h24l-3-10H47z" {...STROKE} />
        </>
      );
    case "notebook":
      return (
        <>
          <rect x="28" y="12" width="52" height="64" rx="2" fill="var(--danger-soft)" stroke="currentColor" strokeWidth="2" />
          <path d="M28 24h-6M28 40h-6M28 56h-6M40 28h28M40 38h28M40 48h18" {...STROKE} />
          <path d="M62 56l6 6 12-14" {...STROKE} stroke="var(--success)" />
        </>
      );
  }
}

interface EmptyStateProps {
  illustration?: Illustration;
  title: string;
  body?: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ illustration = "inbox", title, body, action, compact = false }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center rounded border border-dashed border-border text-center ${compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10"}`}>
      <svg viewBox="0 0 112 88" width={compact ? 84 : 112} height={compact ? 66 : 88} className="text-muted" aria-hidden="true">
        <Drawing kind={illustration} />
      </svg>
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
