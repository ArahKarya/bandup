import { SKILLS, type Skill } from "@/lib/plan/study-plan";
import type { SkillBands } from "@/lib/stats/bands";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { SkillIcon, Stat } from "@/components/ui";

/** Current band per skill with its two-week change: the headline before the charts. */

interface TrendSummaryProps {
  bands: SkillBands;
  trends: Record<Skill, number | null>;
  target: number;
  t: Dictionary;
}

export function TrendSummary({ bands, trends, target, t }: TrendSummaryProps) {
  return (
    <section aria-label={t.progress.overTime} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {SKILLS.map((s) => {
        const band = bands[s];
        const delta = trends[s];
        return (
          <Stat
            key={s}
            label={t.skill[s]}
            icon={<SkillIcon skill={s} size="sm" />}
            value={
              <span className={band === undefined ? "text-muted" : band >= target ? "text-success" : ""}>{band === undefined ? t.common.none : band.toFixed(1)}</span>
            }
            delta={delta}
            deltaLabel={delta === null ? t.motivation.trend.none : t.motivation.trend.vs}
          />
        );
      })}
    </section>
  );
}
