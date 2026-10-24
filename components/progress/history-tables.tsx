import Link from "next/link";
import type { AttemptSummary, SubmissionSummary } from "@/lib/server/stats";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { formatDay } from "@/lib/stats/dates";
import { attemptTitle, scoreText } from "@/components/dashboard/recent-list";
import { Badge, Empty } from "@/components/ui";

/** Attempt and submission history tables for the progress page. */

const th = "border-b border-border px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted";
const td = "border-b border-border px-3 py-2.5 align-middle";

export function AttemptTable({ attempts, t, locale }: { attempts: AttemptSummary[]; t: Dictionary; locale: string }) {
  if (attempts.length === 0) return <Empty>{t.progress.noAttempts}</Empty>;
  return (
    <div className="overflow-x-auto rounded border border-border bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <th scope="col" className={th}>{t.progress.date}</th>
            <th scope="col" className={th}>{t.progress.item}</th>
            <th scope="col" className={th}>{t.progress.mode}</th>
            <th scope="col" className={`${th} text-right`}>{t.progress.score}</th>
            <th scope="col" className={`${th} text-right`}>{t.progress.band}</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map((a) => (
            <tr key={a.id} className="hover:bg-surface-2">
              <td className={`${td} whitespace-nowrap text-muted`}>
                <time dateTime={a.submittedAt.toISOString()}>{formatDay(a.submittedAt, locale)}</time>
              </td>
              <td className={td}>
                <Link href={`/attempt/${a.id}`} className="font-medium hover:text-accent hover:underline">
                  {attemptTitle(a, t)}
                </Link>
              </td>
              <td className={td}>
                <Badge tone={a.mode === "mock" ? "accent" : "neutral"}>{t.progress.modes[a.mode]}</Badge>
              </td>
              <td className={`${td} text-right tabular-nums`}>{scoreText(a, t)}</td>
              <td className={`${td} text-right font-semibold tabular-nums`}>{a.band !== null ? a.band.toFixed(1) : t.common.none}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SubmissionListProps {
  items: SubmissionSummary[];
  /** "/writing" or "/speaking". */
  basePath: string;
  /** "Task" or "Part". */
  numberLabel: string;
  t: Dictionary;
  locale: string;
}

export function SubmissionList({ items, basePath, numberLabel, t, locale }: SubmissionListProps) {
  if (items.length === 0) return <Empty>{t.progress.noSubmissions}</Empty>;
  return (
    <ul className="divide-y divide-border rounded border border-border bg-surface">
      {items.map((s) => (
        <li key={s.id}>
          <Link href={`${basePath}/${s.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{s.title}</p>
              <p className="text-xs text-muted">
                {numberLabel} {s.number} · <time dateTime={s.createdAt.toISOString()}>{formatDay(s.createdAt, locale)}</time>
              </p>
            </div>
            {s.band !== null ? (
              <span className="shrink-0 font-semibold tabular-nums">{s.band.toFixed(1)}</span>
            ) : (
              <Badge tone="warning">{t.progress.notScored}</Badge>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
