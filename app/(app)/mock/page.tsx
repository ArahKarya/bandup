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
import { Clock, PlayCircle, ShieldAlert, Timer } from "lucide-react";
import { Badge, BandValue, Button, Card, EmptyState, PageHeader, SKILL_META, SkillIcon, type SkillKey } from "@/components/ui";

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

  const sections: { skill: SkillKey; minutes: number; label: string }[] = [
    { skill: "listening", minutes: MOCK_MINUTES.listening, label: `${MOCK_MINUTES.listening} ${t.common.minutes}` },
    { skill: "reading", minutes: MOCK_MINUTES.reading, label: `${MOCK_MINUTES.reading} ${t.common.minutes}` },
    { skill: "writing", minutes: MOCK_MINUTES.writing, label: `${MOCK_MINUTES.writing} ${t.common.minutes}` },
    { skill: "speaking", minutes: 14, label: `11–14 ${t.common.minutes}` },
  ];
  const sumMinutes = sections.reduce((n, x) => n + x.minutes, 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.mock.title} sub={t.mock.sub} icon={<Timer size={20} aria-hidden="true" />} />

      <div className="mb-8 flex items-start gap-3 rounded border border-warning/40 bg-warning-soft p-4 text-sm">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <strong>{t.mock.strict}</strong>
          <p className="mt-0.5">{t.mock.strictHint}</p>
        </div>
      </div>

      {mocks.length === 0 && <EmptyState illustration="target" title={t.practice.empty} />}

      <div className="grid gap-5 md:grid-cols-2">
        {mocks.map((m) => {
          const open = attempts.find((a) => a.contentId === m.id && a.status === "in_progress");
          const taken = past.filter((p) => p.attempt.contentId === m.id);
          const lastOverall = taken.find((p) => p.bands.overall !== null)?.bands.overall ?? null;
          return (
            <Card key={m.id} className="flex flex-col gap-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge tone={m.payload.module === profile.module ? "accent" : "neutral"}>{t.module[m.payload.module]}</Badge>
                  <h2 className="mt-2 text-lg font-semibold">{m.title}</h2>
                  {m.payload.description && <p className="mt-1 text-sm text-muted">{m.payload.description}</p>}
                </div>
                {lastOverall !== null && (
                  <div className="text-right">
                    <p className="text-xs text-muted">{t.skill.overall}</p>
                    <BandValue band={lastOverall} target={profile.targetBand} size="lg" />
                  </div>
                )}
              </div>

              {/* Timeline of the test: segment widths follow each section's length. */}
              <div>
                <div className="flex h-2 overflow-hidden rounded-sm" aria-hidden="true">
                  {sections.map((x) => (
                    <div key={x.skill} className={SKILL_META[x.skill].bg} style={{ width: `${(x.minutes / sumMinutes) * 100}%` }} />
                  ))}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {sections.map((x) => (
                    <li key={x.skill} className="flex items-center gap-2">
                      <SkillIcon skill={x.skill} size="sm" />
                      <span>{t.skill[x.skill]}</span>
                      <span className="ml-auto text-xs text-muted tabular-nums">{x.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                  <Clock size={12} aria-hidden="true" />≈ {Math.round((total / 60) * 10) / 10} h + Speaking
                </p>
              </div>

              {taken.length > 0 && (
                <ul className="flex flex-col divide-y divide-border rounded border border-border text-sm">
                  {taken.map(({ attempt, bands }) => (
                    <li key={attempt.id}>
                      <Link href={`/attempt/${attempt.id}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-surface-2">
                        <span className="text-muted">{attempt.submittedAt?.toLocaleDateString(locale === "id" ? "id-ID" : "en-GB")}</span>
                        <span className="flex items-center gap-3 text-xs tabular-nums text-muted">
                          {(["listening", "reading", "writing", "speaking"] as const).map((k) => (
                            <span key={k} className={SKILL_META[k].text}>
                              {bands[k]?.toFixed(1) ?? "—"}
                            </span>
                          ))}
                          <BandValue band={bands.overall} target={profile.targetBand} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <form action={startMockAction} className="mt-auto">
                <input type="hidden" name="contentId" value={m.id} />
                <Button type="submit" className="w-full">
                  {open ? <PlayCircle size={16} aria-hidden="true" /> : <Timer size={16} aria-hidden="true" />}
                  {open ? t.mock.resume : t.mock.start}
                </Button>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
