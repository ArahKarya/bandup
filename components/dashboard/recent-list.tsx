import Link from "next/link";
import type { AttemptSummary } from "@/lib/server/stats";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatDay } from "@/lib/stats/dates";
import { ClipboardCheck, Compass } from "lucide-react";
import { Badge, Card, SkillIcon, isSkillKey } from "@/components/ui";

export function attemptTitle(a: AttemptSummary, t: Dictionary): string {
  return a.title ?? t.progress.placement;
}

export function scoreText(a: Pick<AttemptSummary, "rawScore" | "maxScore">, t: Dictionary): string {
  return a.rawScore !== null && a.maxScore ? `${a.rawScore}/${a.maxScore}` : t.common.none;
}

/** Compact list of recent attempts for the dashboard. */
export function RecentList({ attempts, t, locale }: { attempts: AttemptSummary[]; t: Dictionary; locale: string }) {
  return (
    <Card className="divide-y divide-border">
      {attempts.map((a) => (
        <Link key={a.id} href={`/attempt/${a.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-2">
          <AttemptIcon attempt={a} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{attemptTitle(a, t)}</p>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Badge tone={a.mode === "mock" ? "accent" : "neutral"}>{t.progress.modes[a.mode]}</Badge>
              <time dateTime={a.submittedAt.toISOString()}>{formatDay(a.submittedAt, locale)}</time>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold tabular-nums">{a.band !== null ? a.band.toFixed(1) : t.common.none}</p>
            <p className="text-xs tabular-nums text-muted">{scoreText(a, t)}</p>
          </div>
        </Link>
      ))}
    </Card>
  );
}

/** Skill icon for single-skill sets; a test or compass glyph for mocks and placement. */
function AttemptIcon({ attempt }: { attempt: AttemptSummary }) {
  if (isSkillKey(attempt.skill)) return <SkillIcon skill={attempt.skill} />;
  const Icon = attempt.mode === "placement" ? Compass : ClipboardCheck;
  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accent-soft text-accent" aria-hidden="true">
      <Icon size={17} />
    </span>
  );
}
