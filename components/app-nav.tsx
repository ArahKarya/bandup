"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LibraryBig,
  LineChart,
  Monitor,
  Moon,
  NotebookPen,
  Settings,
  ShieldCheck,
  Sun,
  Timer,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { setThemeAction } from "@/app/actions/ui";

const ICONS = {
  dashboard: LayoutDashboard,
  plan: CalendarDays,
  learn: BookOpen,
  vocab: LibraryBig,
  practice: ClipboardCheck,
  mock: Timer,
  mistakes: NotebookPen,
  progress: LineChart,
  achievements: Trophy,
  settings: Settings,
  admin: ShieldCheck,
} satisfies Record<string, LucideIcon>;

export type NavIcon = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Small count shown on the right, e.g. words due. */
  badge?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export function Icon({ name, className = "", size = 18 }: { name: NavIcon; className?: string; size?: number }) {
  const C = ICONS[name];
  return <C size={size} strokeWidth={1.9} className={className} aria-hidden="true" />;
}

export function AppNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted uppercase">{group.label}</p>
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors ${active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"}`}
              >
                {active && <span className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-sm bg-accent" aria-hidden="true" />}
                <Icon name={item.icon} />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="rounded bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-fg tabular-nums">{item.badge > 99 ? "99+" : item.badge}</span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

const THEMES = [
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
  { id: "system", icon: Monitor },
] as const;

export function ThemeSwitch({ theme, labels }: { theme: "light" | "dark" | "system"; labels: Record<"light" | "dark" | "system" | "title", string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex overflow-hidden rounded border border-border" role="radiogroup" aria-label={labels.title}>
      {THEMES.map(({ id, icon: I }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={theme === id}
          title={labels[id]}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setThemeAction(id);
              router.refresh();
            })
          }
          className={`flex flex-1 items-center justify-center py-1.5 ${theme === id ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}
        >
          <I size={15} aria-hidden="true" />
          <span className="sr-only">{labels[id]}</span>
        </button>
      ))}
    </div>
  );
}
