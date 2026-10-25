import Link from "next/link";
import { CheckCircle2, Clock, Flame, PlayCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, Button, LinkButton, SKILL_META, SkillIcon, type SkillKey } from "@/components/ui";
import { startPracticeAction } from "@/app/actions/attempts";

export interface SetCardData {
  id: string;
  skill: SkillKey;
  title: string;
  eyebrow: string;
  categories: string[];
  meta: string;
  best: { raw: number; max: number } | null;
  inProgress: boolean;
  weak: boolean;
}

interface Labels {
  start: string;
  resume: string;
  retry: string;
  best: string;
  inProgress: string;
  weakHint: string;
}

/** Difficulty as three small bars, so it reads without a label. */
function DifficultyBars({ level, label }: { level: number; label: string }) {
  return (
    <span className="inline-flex items-end gap-0.5" title={label} aria-label={label}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`w-1 rounded-[1px] ${i <= level ? "bg-fg/70" : "bg-border"}`} style={{ height: 4 + i * 3 }} />
      ))}
    </span>
  );
}

export function SetCard({ data, difficulty, difficultyLabel, labels }: { data: SetCardData; difficulty: number; difficultyLabel: string; labels: Labels }) {
  const meta = SKILL_META[data.skill];
  const pct = data.best ? data.best.raw / data.best.max : null;
  return (
    <article className={`group flex flex-col gap-3 rounded border border-border bg-surface p-4 shadow-card transition-colors hover:border-fg/20`}>
      <div className={`-mx-4 -mt-4 h-1 rounded-t ${meta.bg}`} aria-hidden="true" />
      <div className="flex items-start gap-3">
        <SkillIcon skill={data.skill} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{data.eyebrow}</p>
          <h3 className="mt-0.5 leading-snug font-semibold">{data.title}</h3>
        </div>
        {data.best && <CheckCircle2 size={18} className="shrink-0 text-success" aria-label={labels.best} />}
      </div>
      <div className="flex flex-wrap gap-1">
        {data.categories.map((c) => (
          <Badge key={c}>{c}</Badge>
        ))}
        {data.weak && (
          <Badge tone="warning">
            <Flame size={12} className="mr-0.5" aria-hidden="true" />
            {labels.weakHint}
          </Badge>
        )}
      </div>
      {pct !== null && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{labels.best}</span>
          <div className="h-1.5 flex-1 rounded-sm bg-surface-2">
            <div className={`h-full rounded-sm ${pct >= 0.75 ? "bg-success" : pct >= 0.5 ? "bg-warning" : "bg-danger"}`} style={{ width: `${pct * 100}%` }} />
          </div>
          <span className="tabular-nums">
            {data.best!.raw}/{data.best!.max}
          </span>
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="flex items-center gap-2 text-sm text-muted">
          <DifficultyBars level={difficulty} label={difficultyLabel} />
          <span className="inline-flex items-center gap-1">
            <Clock size={13} aria-hidden="true" />
            {data.meta}
          </span>
        </span>
        <form action={startPracticeAction}>
          <input type="hidden" name="contentId" value={data.id} />
          <Button size="sm" variant={data.best && !data.inProgress ? "secondary" : "primary"}>
            {data.inProgress ? (
              <>
                <PlayCircle size={14} aria-hidden="true" /> {labels.resume}
              </>
            ) : data.best ? (
              labels.retry
            ) : (
              labels.start
            )}
          </Button>
        </form>
      </div>
    </article>
  );
}

export function TaskCard({ skill, href, eyebrow, title, done, cta, children }: { skill: SkillKey; href: string; eyebrow: string; title: string; done: boolean; cta: string; children?: ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded border border-border bg-surface p-4 shadow-card">
      <div className={`-mx-4 -mt-4 h-1 rounded-t ${SKILL_META[skill].bg}`} aria-hidden="true" />
      <div className="flex items-start gap-3">
        <SkillIcon skill={skill} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{eyebrow}</p>
          <h3 className="mt-0.5 leading-snug font-semibold">
            <Link href={href} className="hover:text-accent">
              {title}
            </Link>
          </h3>
        </div>
        {done && <CheckCircle2 size={18} className="shrink-0 text-success" aria-hidden="true" />}
      </div>
      {children}
      <div className="mt-auto flex justify-end">
        <LinkButton href={href} size="sm" variant={done ? "secondary" : "primary"}>
          {cta}
        </LinkButton>
      </div>
    </article>
  );
}
