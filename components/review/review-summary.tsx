import { ArrowLeft, RotateCcw, TriangleAlert } from "lucide-react";
import type { SectionResult } from "@/lib/attempt/sections";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { fmt } from "@/lib/i18n/dictionaries";
import { answeredCount } from "@/lib/mistakes/notebook";
import { retryWrongAction } from "@/app/actions/mistakes";
import { BandValue, Button, Card, LinkButton, ProgressBar, SkillIcon, isSkillKey } from "@/components/ui";

const skillName = (t: Dictionary, skill: string): string => t.skill[skill as keyof typeof t.skill] ?? skill;

/** One card per graded section: score, answered count, band (or why there is none). */
export function SectionCards({ sections, target, t }: { sections: SectionResult[]; target?: number; t: Dictionary }) {
  return (
    <>
      {sections.map((s) => {
        const items = s.sets.flatMap((set) => set.items);
        const count = answeredCount(items);
        return (
          <Card key={s.skill} className="flex flex-col gap-1 p-4">
            <div className="flex items-center gap-2">
              {isSkillKey(s.skill) && <SkillIcon skill={s.skill} size="sm" />}
              <p className="text-sm text-muted">{skillName(t, s.skill)}</p>
            </div>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {s.raw}/{s.max}
            </p>
            <p className="text-xs text-muted">{fmt(t.mistakes.answered, { a: count.answered, b: count.total })}</p>
            {s.skill !== "grammar" && s.band !== null && (
              <p className="mt-1 text-sm">
                {t.review.band}: {count.reliable ? <BandValue band={s.band} target={target} /> : <span className="font-semibold">—</span>}
              </p>
            )}
            {s.skill !== "grammar" && s.band !== null && !count.reliable && (
              <p className="mt-1 flex gap-1.5 text-xs text-warning">
                <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
                {t.mistakes.unreliable}
              </p>
            )}
          </Card>
        );
      })}
    </>
  );
}

/** "Retry wrong answers (n)" for one skill of a finished attempt. */
export function RetryWrongButton({ attemptId, skill, count, label, variant = "primary" }: { attemptId: string; skill?: string; count: number; label: string; variant?: "primary" | "secondary" }) {
  return (
    <form action={retryWrongAction}>
      <input type="hidden" name="attemptId" value={attemptId} />
      {skill && <input type="hidden" name="skill" value={skill} />}
      <Button type="submit" variant={variant}>
        <RotateCcw size={16} aria-hidden="true" />
        {fmt(label, { n: count })}
      </Button>
    </form>
  );
}

/** Per-skill retry buttons, for attempts with wrong answers in more than one skill (mocks). */
export function RetryBySkill({ attemptId, counts, t }: { attemptId: string; counts: { skill: string; count: number }[]; t: Dictionary }) {
  return (
    <div className="flex flex-wrap gap-2">
      {counts.map(({ skill, count }) => (
        <RetryWrongButton key={skill} attemptId={attemptId} skill={skill} count={count} variant="secondary" label={`${t.mistakes.retryWrongN} · ${skillName(t, skill)}`} />
      ))}
    </div>
  );
}

/** A drill's outcome in notebook terms: how many of the drilled questions are now mastered. */
export function DrillProgress({ mastered, total, t }: { mastered: number; total: number; t: Dictionary }) {
  return (
    <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-lg font-semibold tabular-nums">{fmt(t.mistakes.drillProgress, { x: mastered, y: total })}</p>
        <ProgressBar value={mastered} max={total} className="max-w-sm" />
        <p className="text-sm text-muted">{t.mistakes.drillProgressSub}</p>
      </div>
      <LinkButton href="/mistakes" variant="secondary">
        <ArrowLeft size={16} aria-hidden="true" />
        {t.mistakes.backToNotebook}
      </LinkButton>
    </Card>
  );
}
