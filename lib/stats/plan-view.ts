import { humanCategory, type PlanActivity, type PlanDay, type StudyPlan } from "@/lib/plan/study-plan";

/** Where each plan activity takes the learner. */
export function activityHref(a: PlanActivity): string {
  switch (a.kind) {
    case "lesson":
      return "/learn";
    case "vocab":
      return "/vocab/review";
    case "mock":
      return "/mock";
    case "practice":
    case "review":
      if (a.category) return `/practice?category=${encodeURIComponent(a.category)}`;
      if (a.skill) return `/practice?skill=${encodeURIComponent(a.skill)}`;
      return "/practice";
  }
}

export interface ActivityLabels {
  lesson: string;
  practice: string;
  drill: string;
  vocab: string;
  mock: string;
  review: string;
}

/**
 * Localised label for an activity. The generator's own labels are English; the templates
 * here take `{skill}` and `{category}` so the UI language follows the learner.
 */
export function activityLabel(a: PlanActivity, labels: ActivityLabels, skillName: (s: string) => string): string {
  const skill = a.skill ? skillName(a.skill) : "";
  const fill = (tpl: string) => tpl.replace("{skill}", skill).replace("{category}", a.category ? humanCategory(a.category) : "");
  if (a.kind === "practice" && a.category) return fill(labels.drill);
  return fill(labels[a.kind]);
}

export type PlanPhase = "foundation" | "build" | "exam" | "final";

/**
 * Recovers the phase from a week's focus text so it can be translated. The generator only
 * exposes the English sentence; matching its first word keeps that coupling to one place.
 */
export function phaseOf(focus: string): PlanPhase | null {
  const word = focus.split(/[\s:]/)[0]?.toLowerCase();
  if (word === "foundations") return "foundation";
  if (word === "build") return "build";
  if (word === "exam") return "exam";
  if (word === "final") return "final";
  return null;
}

/** The plan day for `isoDate`, or null on a rest day / outside the plan. */
export function planDayFor(plan: StudyPlan, isoDate: string): PlanDay | null {
  return plan.weeks.flatMap((w) => w.days).find((d) => d.date === isoDate) ?? null;
}
