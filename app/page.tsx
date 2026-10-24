import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { Logo } from "@/components/logo";
import { LocaleSwitch } from "@/components/locale-switch";
import { LinkButton } from "@/components/ui";

/** Set NEXT_PUBLIC_REPO_URL to show a link to your fork or the upstream repository. */
const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

export default async function Landing() {
  if (await currentUser()) redirect("/dashboard");
  const { t, locale } = await getDictionary();

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-3">
          <LocaleSwitch locale={locale} />
          <Link href="/login" className="text-sm font-medium hover:text-accent">
            {t.auth.login}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <section className="grid gap-10 py-14 md:grid-cols-[1.2fr_1fr] md:items-center md:py-20">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{t.landing.headline}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">{t.landing.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/register" size="lg">{t.landing.start}</LinkButton>
              {REPO_URL && <LinkButton href={REPO_URL} variant="secondary" size="lg">GitHub</LinkButton>}
            </div>
          </div>
          <BandPreview />
        </section>

        <section className="grid gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2">
          {t.landing.features.map(([title, body]) => (
            <div key={title} className="bg-surface p-6">
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted">{body}</p>
            </div>
          ))}
        </section>

        <p className="py-12 text-center text-sm text-muted">{t.landing.oss}</p>
      </main>
    </div>
  );
}

/** Static illustration of the tracker — no data, just the idea. */
function BandPreview() {
  const rows = [
    ["Listening", 7.5, 7],
    ["Reading", 7, 7],
    ["Writing", 6, 7],
    ["Speaking", 6.5, 7],
  ] as const;
  return (
    <div className="rounded border border-border bg-surface p-5" aria-hidden="true">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted">Overall (estimate)</span>
        <span className="text-3xl font-semibold tabular-nums">6.5 <span className="text-base text-muted">/ 7.0</span></span>
      </div>
      <div className="mt-5 flex flex-col gap-3">
        {rows.map(([skill, band, target]) => (
          <div key={skill}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{skill}</span>
              <span className={`tabular-nums ${band >= target ? "text-success" : "text-warning"}`}>{band.toFixed(1)}</span>
            </div>
            <div className="relative h-2 rounded-sm bg-surface-2">
              <div className="h-full rounded-sm bg-accent" style={{ width: `${(band / 9) * 100}%` }} />
              <div className="absolute top-[-3px] h-[14px] w-0.5 bg-fg" style={{ left: `${(target / 9) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
