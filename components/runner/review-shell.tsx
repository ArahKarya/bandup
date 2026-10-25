import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

/** A minimal app frame for pages inside the focus-mode route group (results, speaking). */
export function ReviewShell({ backLabel, children, wide = true }: { backLabel: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <Link href="/dashboard" aria-label="BandUp">
          <Logo />
        </Link>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </Link>
      </header>
      <main className={`animate-rise mx-auto w-full min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>{children}</main>
    </div>
  );
}
