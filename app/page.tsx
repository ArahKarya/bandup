import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarCheck,
  ChartNoAxesCombined,
  ClipboardList,
  MessagesSquare,
  NotebookPen,
  Target,
  Timer,
} from "lucide-react";
import { currentUser } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { Logo } from "@/components/logo";
import { LocaleSwitch } from "@/components/locale-switch";
import { BandBar, LinkButton, SKILL_META, SkillIcon, type SkillKey } from "@/components/ui";

/** Set NEXT_PUBLIC_REPO_URL to point the GitHub links at your fork. */
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "https://github.com/ArahKarya/bandup";

const FEATURE_ICONS = [Timer, ClipboardList, NotebookPen, MessagesSquare, CalendarCheck, ChartNoAxesCombined];
const SCREENS = ["dashboard", "runner", "writing"] as const;

/** Product screenshots are generated into public/screens; the section hides until they exist. */
function hasScreens(): boolean {
  return SCREENS.every((s) => existsSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", "screens", `${s}-light.png`)));
}

export default async function Landing() {
  if (await currentUser()) redirect("/dashboard");
  const { t, locale } = await getDictionary();
  const l = t.landing;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <div className="flex items-center gap-3">
            <LocaleSwitch locale={locale} />
            <Link href="/login" className="text-sm font-medium hover:text-accent">
              {t.auth.login}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-[1.15fr_1fr] md:items-center md:py-20">
          <div className="animate-rise">
            <p className="mb-4 inline-flex items-center gap-2 rounded border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-sm bg-accent" aria-hidden="true" />
              {l.eyebrow}
            </p>
            <h1 className="max-w-xl text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">{l.headline}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{l.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/register" size="lg">
                {l.start} <ArrowRight size={18} aria-hidden="true" />
              </LinkButton>
              <LinkButton href="/login" variant="secondary" size="lg">
                {l.login}
              </LinkButton>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              {l.stats.map(([value, label]) => (
                <div key={label}>
                  <dt className="sr-only">{label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
                  <dd className="text-xs text-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <HeroPreview targetLabel="Target" overallLabel={t.skill.overall} skillLabels={t.skill} />
        </section>

        {/* Features */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
            <h2 className="max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">{l.featuresTitle}</h2>
            <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {l.features.map(([title, body], i) => {
                const Icon = FEATURE_ICONS[i] ?? Target;
                return (
                  <div key={title} className="flex flex-col gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded bg-accent-soft text-accent">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{l.howTitle}</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {l.how.map(([title, body], i) => (
              <li key={title} className="relative rounded border border-border bg-surface p-6 shadow-card">
                <span className="text-sm font-semibold text-accent tabular-nums">0{i + 1}</span>
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {hasScreens() && (
          <section className="border-y border-border bg-surface">
            <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{l.screensTitle}</h2>
              <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {SCREENS.map((s, i) => (
                  <figure key={s} className="flex flex-col gap-3">
                    <picture>
                      <source srcSet={`/screens/${s}-dark.png`} media="(prefers-color-scheme: dark)" />
                      <img src={`/screens/${s}-light.png`} alt={l.screens[i]} loading="lazy" className="w-full rounded border border-border shadow-card" />
                    </picture>
                    <figcaption className="text-sm font-medium text-muted">{l.screens[i]}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{l.faqTitle}</h2>
          <div className="mt-8 divide-y divide-border rounded border border-border bg-surface">
            {l.faq.map(([q, a]) => (
              <details key={q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {q}
                  <span className="text-muted transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
          <div className="flex flex-col items-start gap-5 rounded border border-border bg-accent px-6 py-10 text-accent-fg sm:flex-row sm:items-center sm:justify-between sm:px-10">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">{l.ctaTitle}</h2>
              <p className="mt-2 opacity-90">{l.ctaBody}</p>
            </div>
            <Link href="/register" className="inline-flex h-12 items-center gap-2 rounded bg-surface px-5 font-medium text-fg hover:bg-surface-2">
              {l.start} <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex max-w-xl flex-col gap-2">
            <Logo />
            <p>{l.oss}</p>
            <p className="text-xs">{l.footerNote}</p>
          </div>
          <a href={REPO_URL} className="inline-flex items-center gap-2 font-medium text-fg hover:text-accent" rel="noopener">
            <GithubMark /> {l.github}
          </a>
        </div>
      </footer>
    </div>
  );
}

/** Static illustration of the dashboard — sample numbers, not real data. */
function HeroPreview({ targetLabel, overallLabel, skillLabels }: { targetLabel: string; overallLabel: string; skillLabels: Record<string, string> }) {
  const rows: [SkillKey, number][] = [
    ["listening", 7.5],
    ["reading", 7],
    ["writing", 6],
    ["speaking", 6.5],
  ];
  return (
    <div className="animate-rise relative" aria-hidden="true">
      <div className="absolute -inset-4 -z-10 rounded bg-[radial-gradient(60%_60%_at_70%_30%,var(--accent-soft),transparent)]" />
      <div className="rounded border border-border bg-surface p-5 shadow-pop">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-muted">{overallLabel}</p>
            <p className="text-4xl font-semibold tabular-nums">6.5</p>
          </div>
          <p className="text-sm text-muted">
            {targetLabel} <span className="font-semibold text-fg">7.0</span>
          </p>
        </div>
        <div className="mt-5 flex flex-col gap-3.5">
          {rows.map(([skill, band]) => (
            <div key={skill} className="flex items-center gap-3">
              <SkillIcon skill={skill} size="sm" />
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-sm">
                  <span>{skillLabels[skill]}</span>
                  <span className="font-medium tabular-nums">{band.toFixed(1)}</span>
                </div>
                <BandBar band={band} target={7} color={SKILL_META[skill].cssVar} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-[repeat(21,minmax(0,1fr))] gap-1">
          {Array.from({ length: 63 }, (_, i) => {
            const level = [0, 1, 2, 3, 2, 1, 3, 0, 2, 3, 3, 1][(i * 7) % 12];
            return <span key={i} className="aspect-square rounded-[2px]" style={{ background: level === 0 ? "var(--surface-2)" : `color-mix(in oklab, var(--accent) ${level * 30}%, var(--surface-2))` }} />;
          })}
        </div>
      </div>
    </div>
  );
}

function GithubMark() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
