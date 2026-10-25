import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { SKILLS, type Skill } from "@/lib/plan/study-plan";
import type { SkillBands } from "@/lib/stats/bands";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";
import { BandBar, BandGauge, Card, SKILL_META, SkillIcon } from "@/components/ui";

/** Overall estimate on a gauge beside one bar per skill, each with a two-week trend. */

interface BandOverviewProps {
  overall: number | null;
  target: number;
  bands: SkillBands;
  trends: Record<Skill, number | null>;
  t: Dictionary;
}

export function BandOverview({ overall, target, bands, trends, t }: BandOverviewProps) {
  const caption = `${t.dashboard.target} ${target.toFixed(1)}`;
  const gaugeLabel = `${t.dashboard.estimate}: ${overall === null ? t.common.none : overall.toFixed(1)}, ${caption}`;
  return (
    <Card className="grid gap-6 p-5 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:items-center">
      <div className="flex flex-col items-center gap-1">
        <h2 className="text-sm text-muted">
          {t.dashboard.estimate} · {t.skill.overall}
        </h2>
        <BandGauge band={overall} target={target} label={gaugeLabel} caption={caption} />
        {overall === null && <p className="text-center text-xs text-muted">{t.dashboard.estimateHint}</p>}
      </div>
      <ul className="flex flex-col gap-4">
        {SKILLS.map((s) => (
          <li key={s} className="flex items-center gap-3">
            <SkillIcon skill={s} />
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{t.skill[s]}</span>
                <span className="flex items-center gap-2">
                  <Trend delta={trends[s]} t={t} />
                  <span className="w-8 text-right font-semibold tabular-nums">{bands[s]?.toFixed(1) ?? t.common.none}</span>
                </span>
              </div>
              <BandBar band={bands[s] ?? null} target={target} color={SKILL_META[s].cssVar} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Trend({ delta, t }: { delta: number | null; t: Dictionary }) {
  const tr = t.motivation.trend;
  if (delta === null) return <span className="sr-only">{tr.none}</span>;
  const Arrow = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight;
  const tone = delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted";
  const text = delta > 0 ? fmt(tr.up, { n: delta.toFixed(1) }) : delta < 0 ? fmt(tr.down, { n: Math.abs(delta).toFixed(1) }) : tr.flat;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${tone}`} title={`${text} ${tr.vs}`}>
      <Arrow size={14} aria-hidden="true" />
      <span aria-hidden="true">{delta === 0 ? "" : Math.abs(delta).toFixed(1)}</span>
      <span className="sr-only">{`${text} ${tr.vs}`}</span>
    </span>
  );
}
