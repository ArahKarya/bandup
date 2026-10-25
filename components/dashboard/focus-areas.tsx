import type { QuestionCategory } from "@/lib/content/schema";
import { humanCategory } from "@/lib/plan/study-plan";
import type { CategoryStats } from "@/lib/stats/accuracy";
import { accuracyTone } from "@/lib/stats/accuracy";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { Card, EmptyState, LinkButton, SKILL_META, SkillIcon, isSkillKey } from "@/components/ui";

/** Weakest question types, coloured by the skill they are mostly answered in. */

const TONE_TEXT = { success: "text-success", warning: "text-warning", danger: "text-danger" } as const;

interface FocusProps {
  categories: QuestionCategory[];
  stats: CategoryStats;
  categorySkills: ReadonlyMap<string, string>;
  t: Dictionary;
}

export function FocusAreas({ categories, stats, categorySkills, t }: FocusProps) {
  if (categories.length === 0) return <EmptyState compact illustration="target" title={t.dashboard.noWeak} />;
  return (
    <Card className="divide-y divide-border">
      {categories.map((c) => {
        const acc = stats.accuracy[c] ?? 0;
        const count = stats.counts[c];
        const skillRaw = categorySkills.get(c);
        const skill = isSkillKey(skillRaw) ? skillRaw : "reading";
        const pct = Math.round(acc * 100);
        return (
          <div key={c} className="flex items-center gap-3 p-3">
            <SkillIcon skill={skill} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-medium">{humanCategory(c)}</p>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${TONE_TEXT[accuracyTone(acc)]}`}>{pct}%</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={humanCategory(c)}>
                <div className="h-full" style={{ width: `${pct}%`, background: SKILL_META[skill].cssVar }} />
              </div>
              {count && (
                <p className="mt-1 text-xs tabular-nums text-muted">
                  {count.correct}/{count.total} {t.dashboard.correct}
                </p>
              )}
            </div>
            <LinkButton href={`/practice?category=${encodeURIComponent(c)}`} variant="secondary" size="sm">
              {t.dashboard.practiseThis}
            </LinkButton>
          </div>
        );
      })}
    </Card>
  );
}
