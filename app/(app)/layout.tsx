import Link from "next/link";
import { requireUser } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { logoutAction } from "@/app/actions/auth";
import { AppNav, type NavItem } from "@/components/app-nav";
import { Logo } from "@/components/logo";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const { t } = await getDictionary();

  const items: NavItem[] = [
    { href: "/dashboard", label: t.nav.dashboard, icon: "dashboard" },
    { href: "/plan", label: t.nav.plan, icon: "plan" },
    { href: "/learn", label: t.nav.learn, icon: "learn" },
    { href: "/vocab", label: t.nav.vocab, icon: "vocab" },
    { href: "/practice", label: t.nav.practice, icon: "practice" },
    { href: "/mock", label: t.nav.mock, icon: "mock" },
    { href: "/progress", label: t.nav.progress, icon: "progress" },
    { href: "/settings", label: t.nav.settings, icon: "settings" },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: t.nav.admin, icon: "admin" as const }] : []),
  ];

  const footer = (
    <div className="border-t border-border pt-3">
      <p className="truncate px-3 text-sm font-medium">{user.name}</p>
      <p className="truncate px-3 text-xs text-muted">{user.email}</p>
      <form action={logoutAction} className="mt-2">
        <button type="submit" className="w-full rounded px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-fg">
          {t.nav.logout}
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      {/* Mobile: a disclosure menu, no client JS needed. */}
      <details className="group border-b border-border bg-surface lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
          <Logo />
          <span className="rounded border border-border px-2 py-1 text-sm">Menu</span>
        </summary>
        <div className="flex flex-col gap-3 px-3 pb-3">
          <AppNav items={items} />
          {footer}
        </div>
      </details>

      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r border-border bg-surface p-3 lg:flex">
        <div className="flex flex-col gap-6">
          <Link href="/dashboard" className="px-3 pt-2">
            <Logo />
          </Link>
          <AppNav items={items} />
        </div>
        {footer}
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
