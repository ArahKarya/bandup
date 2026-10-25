import { ArrowRight, BookOpen, CirclePlay, ClipboardCheck, GraduationCap, NotebookPen, Sparkles, type LucideIcon } from "lucide-react";
import type { NextStep, NextStepKind } from "@/lib/plan/recommend";
import { humanCategory } from "@/lib/plan/study-plan";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";
import { activityText } from "@/components/plan/activity-list";
import { Card, LinkButton, SKILL_META } from "@/components/ui";

/** The single recommended action, prominent and one click away. */

const KIND_ICON: Record<NextStepKind, LucideIcon> = {
  resume: CirclePlay,
  vocab: BookOpen,
  plan: Sparkles,
  mistakes: NotebookPen,
  weak: Sparkles,
  mock: ClipboardCheck,
  lesson: GraduationCap,
  practice: Sparkles,
};

export function nextStepText(step: NextStep, t: Dictionary): { title: string; body: string } {
  const n = t.motivation.next;
  const skill = step.skill ? t.skill[step.skill] : "";
  const category = step.category ? humanCategory(step.category) : "";
  switch (step.kind) {
    case "resume":
      return { title: n.resume.title, body: step.title ? fmt(n.resume.body, { title: step.title }) : n.resumeUntitled };
    case "vocab":
      return { title: fmt(n.vocab.title, { n: step.count ?? 0 }), body: n.vocab.body };
    case "plan":
      return { title: step.activity ? activityText(step.activity, t) : n.plan.title, body: n.plan.body };
    case "mistakes":
      return { title: fmt(n.mistakes.title, { n: step.count ?? 0 }), body: n.mistakes.body };
    case "weak":
      return { title: fmt(n.weak.title, { category }), body: n.weak.body };
    case "mock":
      return n.mock;
    case "lesson":
      return { title: n.lesson.title, body: step.title ?? "" };
    case "practice":
      return { title: fmt(n.practice.title, { skill }), body: n.practice.body };
  }
}

export function NextStepCard({ step, t }: { step: NextStep; t: Dictionary }) {
  const { title, body } = nextStepText(step, t);
  const meta = step.skill ? SKILL_META[step.skill] : null;
  const Icon = meta ? meta.icon : KIND_ICON[step.kind];
  return (
    <Card className="relative flex flex-col gap-4 overflow-hidden border-accent p-5 sm:flex-row sm:items-center" data-testid="next-step">
      <span className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded ${meta ? `${meta.soft} ${meta.text}` : "bg-accent-soft text-accent"}`} aria-hidden="true">
        <Icon size={24} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-accent">{t.motivation.next.title}</h2>
        <p className="mt-0.5 text-lg font-semibold">{title}</p>
        {body && <p className="text-sm text-muted">{body}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="text-sm tabular-nums text-muted">
          ~{step.minutes} {t.common.minutes}
        </span>
        <LinkButton href={step.href}>
          {step.kind === "resume" ? t.dashboard.continue : t.motivation.next.start}
          <ArrowRight size={16} aria-hidden="true" />
        </LinkButton>
      </div>
    </Card>
  );
}
