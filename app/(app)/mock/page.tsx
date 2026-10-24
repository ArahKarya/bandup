import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getProfile } from "@/lib/server/profile";
import { listContent } from "@/lib/server/content";
import { mockBands } from "@/lib/server/mock-bands";
import { MOCK_MINUTES } from "@/lib/attempt/sections";
import { db } from "@/lib/server/db";
import { startMockAction } from "@/app/actions/attempts";
import { BandValue, Button, Card, Empty, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Mock tests" };

export default async function MockListPage() {
  const user = await requireLearner();
  const { t, locale } = await getDictionary();
  const profile = await getProfile(user.id);
  // A General Training candidate sees GT mocks first, but may take Academic ones too.
  const mocks = (await listContent("mock_test")).sort((a, b) => Number(b.module === profile.module) - Number(a.module === profile.module));

  const attempts = await db.attempt.findMany({
    where: { userId: user.id, mode: "mock" },
    orderBy: { startedAt: "desc" },
  });
  const past = await Promise.all(
    attempts.filter((a) => a.status === "submitted").map(async (a) => ({ attempt: a, bands: await mockBands(a.id, a.bands) })),
  );

  const total = MOCK_MINUTES.listening + MOCK_MINUTES.reading + MOCK_MINUTES.writing;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.mock.title} sub={t.mock.sub} />

      <Card className="mb-6 flex flex-col gap-1 border-warning bg-warning-soft p-4 text-sm">
        <strong>{t.mock.strict}</strong>
        <span>{t.mock.strictHint}</span>
      </Card>

      {mocks.length === 0 && <Empty>{t.practice.empty}</Empty>}

      <div className="grid gap-4 md:grid-cols-2">
        {mocks.map((m) => {
          const open = attempts.find((a) => a.contentId === m.id && a.status === "in_progress");
          const taken = past.filter((p) => p.attempt.contentId === m.id);
          return (
            <Card key={m.id} className="flex flex-col gap-4 p-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{t.module[m.payload.module]}</p>
                <h2 className="mt-1 text-lg font-semibold">{m.title}</h2>
                {m.payload.description && <p className="mt-1 text-sm text-muted">{m.payload.description}</p>}
              </div>
              <ul className="grid grid-cols-2 gap-2 text-sm">
                <li>{t.skill.listening} · {MOCK_MINUTES.listening} {t.common.minutes}</li>
                <li>{t.skill.reading} · {MOCK_MINUTES.reading} {t.common.minutes}</li>
                <li>{t.skill.writing} · {MOCK_MINUTES.writing} {t.common.minutes}</li>
                <li>{t.skill.speaking} · 11–14 {t.common.minutes}</li>
              </ul>
              <p className="text-xs text-muted">≈ {Math.round(total / 60 * 10) / 10} h + Speaking</p>
              {taken.length > 0 && (
                <ul className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
                  {taken.map(({ attempt, bands }) => (
                    <li key={attempt.id}>
                      <Link href={`/attempt/${attempt.id}`} className="flex items-center justify-between hover:text-accent">
                        <span>{attempt.submittedAt?.toLocaleDateString(locale === "id" ? "id-ID" : "en-GB")}</span>
                        <BandValue band={bands.overall} target={profile.targetBand} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <form action={startMockAction} className="mt-auto">
                <input type="hidden" name="contentId" value={m.id} />
                <Button type="submit" className="w-full">{open ? t.mock.resume : t.mock.start}</Button>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
