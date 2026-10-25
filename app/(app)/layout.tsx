import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireUser } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getTheme } from "@/lib/server/ui-prefs";
import { getVocabDueCount } from "@/lib/server/stats";
import { logoutAction } from "@/app/actions/auth";
import { AppNav, ThemeSwitch, type NavGroup } from "@/components/app-nav";
import { Logo } from "@/components/logo";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [{ t }, theme, due] = await Promise.all([getDictionary(), getTheme(), user.onboarded ? getVocabDueCount(user.id) : Promise.resolve(0)]);

  const groups: NavGroup[] = [
    {
      label: t.nav.groupHome,
      items: [
        { href: "/dashboard", label: t.nav.dashboard, icon: "dashboard" },
        { href: "/plan", label: t.nav.plan, icon: "plan" },
      ],
    },
    {
      label: t.nav.groupLearn,
      items: [
        { href: "/learn", label: t.nav.learn, icon: "learn" },
        { href: "/vocab", label: t.nav.vocab, icon: "vocab", badge: due },
      ],
    },
    {
      label: t.nav.groupTest,
      items: [
        { href: "/practice", label: t.nav.practice, icon: "practice" },
        { href: "/mock", label: t.nav.mock, icon: "mock" },
        { href: "/mistakes", label: t.nav.mistakes, icon: "mistakes" },
      ],
    },
    {
      label: t.nav.groupTrack,
      items: [
        { href: "/progress", label: t.nav.progress, icon: "progress" },
        { href: "/achievements", label: t.nav.achievements, icon: "achievements" },
        { href: "/settings", label: t.nav.settings, icon: "settings" },
        ...(user.role === "ADMIN" ? [{ href: "/admin", label: t.nav.admin, icon: "admin" as const }] : []),
      ],
    },
  ];

  const footer = (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <ThemeSwitch theme={theme} labels={{ title: t.nav.theme, light: t.nav.themeLight, dark: t.nav.themeDark, system: t.nav.themeSystem }} />
      <div className="flex items-center gap-2.5 px-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent text-xs font-semibold text-accent-fg" aria-hidden="true">
          {initials(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="rounded p-1.5 text-muted hover:bg-surface-2 hover:text-fg" title={t.nav.logout}>
            <LogOut size={16} aria-hidden="true" />
            <span className="sr-only">{t.nav.logout}</span>
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      {/* Mobile: a disclosure menu, no client JS needed. */}
      <details className="group sticky top-0 z-30 border-b border-border bg-surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
          <Logo />
          <span className="rounded border border-border px-2 py-1 text-sm">{t.nav.menu}</span>
        </summary>
        <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto px-3 pb-3">
          <AppNav groups={groups} />
          {footer}
        </div>
      </details>

      {/* The column carries the background so it reaches the bottom of long pages. */}
      <div className="hidden w-64 shrink-0 border-r border-border bg-surface lg:block">
        <aside className="sticky top-0 flex h-screen flex-col justify-between gap-4 overflow-y-auto p-3">
          <div className="flex flex-col gap-5">
            <Link href="/dashboard" className="px-3 pt-2">
              <Logo />
            </Link>
            <AppNav groups={groups} />
          </div>
          {footer}
        </aside>
      </div>

      <main className="animate-rise min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
