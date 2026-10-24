import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type Tab = "overview" | "users" | "content";

const HREF: Record<Tab, string> = { overview: "/admin", users: "/admin/users", content: "/admin/content" };

/** Section tabs for the admin area; square-cornered underline tabs, not pills. */
export function AdminTabs({ current, t }: { current: Tab; t: Dictionary }) {
  const label: Record<Tab, string> = { overview: t.admin.overview, users: t.admin.users, content: t.admin.content };
  return (
    <nav aria-label={t.admin.title} className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
      {(Object.keys(HREF) as Tab[]).map((tab) => (
        <Link
          key={tab}
          href={HREF[tab]}
          aria-current={tab === current ? "page" : undefined}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${tab === current ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"}`}
        >
          {label[tab]}
        </Link>
      ))}
    </nav>
  );
}
