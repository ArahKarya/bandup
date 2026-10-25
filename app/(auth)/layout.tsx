import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { currentUser } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { Logo } from "@/components/logo";
import { LocaleSwitch } from "@/components/locale-switch";
import { BandBar, SKILL_META, SkillIcon, type SkillKey } from "@/components/ui";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await currentUser()) redirect("/dashboard");
  const { t, locale } = await getDictionary();
  const skills: [SkillKey, number][] = [
    ["listening", 7.5],
    ["reading", 7],
    ["writing", 6.5],
    ["speaking", 7],
  ];

  return (
    <main className="grid flex-1 lg:grid-cols-2">
      {/* Brand panel: what you get, at a glance. Hidden on small screens to keep the form first. */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex">
        <Link href="/">
          <Logo />
        </Link>
        <div className="max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">{t.landing.headline}</h2>
          <ul className="mt-6 flex flex-col gap-3">
            {t.landing.features.slice(0, 4).map(([title]) => (
              <li key={title} className="flex items-center gap-2.5 text-sm">
                <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden="true" />
                {title}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col gap-3 rounded border border-border bg-bg p-5" aria-hidden="true">
            {skills.map(([skill, band]) => (
              <div key={skill} className="flex items-center gap-3">
                <SkillIcon skill={skill} size="sm" />
                <span className="w-20 text-sm">{t.skill[skill]}</span>
                <div className="flex-1">
                  <BandBar band={band} target={7} color={SKILL_META[skill].cssVar} />
                </div>
                <span className="w-8 text-right text-sm font-medium tabular-nums">{band.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">{t.landing.oss}</p>
      </section>

      <section className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <LocaleSwitch locale={locale} />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="animate-rise w-full max-w-sm">{children}</div>
        </div>
      </section>
    </main>
  );
}
