import Link from "next/link";
import type { Attempt } from "@/generated/prisma/client";
import { getDictionary } from "@/lib/i18n/server";
import { mockBands } from "@/lib/server/mock-bands";
import { db } from "@/lib/server/db";
import { BandValue, Card, SkillIcon } from "@/components/ui";

/** Four skill bands plus overall, and links to assess the essays and recordings. */
export async function MockSummary({ attempt, target }: { attempt: Attempt; target?: number }) {
  const { t } = await getDictionary();
  const bands = await mockBands(attempt.id, attempt.bands);
  const essays = await db.writingSubmission.findMany({ where: { attemptId: attempt.id }, orderBy: { task: "asc" }, include: { scores: { take: 1, orderBy: { createdAt: "desc" } } } });
  const talks = await db.speakingSubmission.findMany({ where: { attemptId: attempt.id }, orderBy: { part: "asc" }, include: { scores: { take: 1, orderBy: { createdAt: "desc" } } } });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(["listening", "reading", "writing", "speaking"] as const).map((s) => (
          <Card key={s} className="flex flex-col gap-1 p-4">
            <div className="flex items-center gap-2">
              <SkillIcon skill={s} size="sm" />
              <p className="text-sm text-muted">{t.skill[s]}</p>
            </div>
            <BandValue band={bands[s]} target={target} />
          </Card>
        ))}
        <Card className="col-span-2 border-accent p-4 sm:col-span-1">
          <p className="text-sm text-muted">{t.skill.overall}</p>
          <BandValue band={bands.overall} target={target} size="lg" />
        </Card>
      </div>
      {(bands.writing === null || bands.speaking === null) && <p className="text-sm text-warning">{t.mock.pendingWriting}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {essays.map((e) => (
          <Link key={e.id} href={`/writing/${e.id}`} className="flex items-center justify-between rounded border border-border bg-surface p-4 hover:border-accent">
            <span>
              {t.skill.writing} {t.writing.task} {e.task} · {e.wordCount} {t.runner.words}
            </span>
            {e.scores[0] ? <BandValue band={e.scores[0].band} target={target} /> : <span className="text-sm text-accent">{t.writing.assess} →</span>}
          </Link>
        ))}
        {talks.map((s) => (
          <Link key={s.id} href={`/speaking/${s.id}`} className="flex items-center justify-between rounded border border-border bg-surface p-4 hover:border-accent">
            <span>
              {t.skill.speaking} {t.speaking.part} {s.part}
            </span>
            {s.scores[0] ? <BandValue band={s.scores[0].band} target={target} /> : <span className="text-sm text-accent">{t.writing.assess} →</span>}
          </Link>
        ))}
      </div>
    </div>
  );
}
