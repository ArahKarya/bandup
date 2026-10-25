import { DEFAULT_GREETING, EXPECTED_SIGN_OFF } from "./letters";
import { ESSAY_TYPES, LETTER_TONES, type LetterTone, type WritingContext, type WritingKind } from "./task-kind";

/** The planner: what to decide before writing, per kind of task, and the outline it produces. */

export type PlanFieldId =
  | "overview" | "feature1" | "feature2" | "feature3" | "comparisons"
  | "purpose" | "bullet1" | "bullet2" | "bullet3" | "tone" | "opening" | "closing"
  | "questionType" | "position" | "body1" | "support1" | "body2" | "support2" | "conclusion";

export interface PlanField {
  id: PlanFieldId;
  input: "text" | "textarea" | "select";
  options?: readonly string[];
}

const text = (id: PlanFieldId): PlanField => ({ id, input: "text" });
const area = (id: PlanFieldId): PlanField => ({ id, input: "textarea" });

export const PLAN_FIELDS: Readonly<Record<WritingKind, readonly PlanField[]>> = {
  report: [area("overview"), text("feature1"), text("feature2"), text("feature3"), area("comparisons")],
  letter: [
    { id: "tone", input: "select", options: LETTER_TONES },
    text("purpose"), text("bullet1"), text("bullet2"), text("bullet3"), text("opening"), text("closing"),
  ],
  essay: [
    { id: "questionType", input: "select", options: ESSAY_TYPES },
    area("position"), text("body1"), area("support1"), text("body2"), area("support2"), area("conclusion"),
  ],
};

export type Plan = Partial<Record<PlanFieldId, string>>;

const FIELD_IDS: ReadonlySet<string> = new Set(Object.values(PLAN_FIELDS).flatMap((fs) => fs.map((f) => f.id)));
const MAX_FIELD = 2_000;

export function initialPlan(ctx: WritingContext): Plan {
  if (ctx.kind === "letter") return { tone: ctx.tone ?? "formal" };
  if (ctx.kind === "essay") return { questionType: ctx.essayType ?? "opinion" };
  return {};
}

/** Reads a stored plan, keeping only known string fields (localStorage is untrusted input). */
export function parsePlan(value: unknown): Plan {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([k, v]) => FIELD_IDS.has(k) && typeof v === "string")
      .map(([k, v]) => [k, (v as string).slice(0, MAX_FIELD)]),
  ) as Plan;
}

/** True when the learner has written nothing beyond the preset selects. */
export function isPlanEmpty(plan: Plan): boolean {
  return Object.entries(plan).every(([k, v]) => k === "tone" || k === "questionType" || !v?.trim());
}

function or(value: string | undefined, placeholder: string): string {
  const v = value?.trim().replace(/[.\s]+$/, "");
  return v ? v : `[${placeholder}]`;
}

function sentence(value: string | undefined, placeholder: string): string {
  return `${or(value, placeholder)}.`;
}

/** For text that follows "Firstly, " and similar: "Cars" becomes "cars", "UK" stays. */
function mid(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v && /^[A-Z][a-z]/.test(v) && !/^I\b/.test(v) ? `${v[0].toLowerCase()}${v.slice(1)}` : v;
}

function asTone(v: string | undefined, fallback: LetterTone): LetterTone {
  return (LETTER_TONES as readonly string[]).includes(v ?? "") ? (v as LetterTone) : fallback;
}

function reportOutline(p: Plan): string {
  return [
    `The [chart/diagram] shows [what, where, when]. Overall, ${sentence(mid(p.overview), "main trends")}`,
    `${sentence(p.feature1, "key feature 1 with figures")} ${sentence(p.feature2, "key feature 2 with figures")}`,
    `${sentence(p.feature3, "key feature 3 with figures")} ${sentence(p.comparisons, "comparisons")}`,
  ].join("\n\n");
}

function letterOutline(p: Plan, ctx: WritingContext): string {
  const tone = asTone(p.tone, ctx.tone ?? "formal");
  const opening = p.opening?.trim() || DEFAULT_GREETING[tone];
  const closing = p.closing?.trim() || `${EXPECTED_SIGN_OFF[tone]},`;
  return [
    opening.endsWith(",") ? opening : `${opening},`,
    `I am writing to ${sentence(mid(p.purpose), "purpose of the letter")}`,
    sentence(p.bullet1, "first bullet point"),
    sentence(p.bullet2, "second bullet point"),
    sentence(p.bullet3, "third bullet point"),
    `${closing.endsWith(",") ? closing : `${closing},`}\n[Your name]`,
  ].join("\n\n");
}

function essayOutline(p: Plan): string {
  return [
    `[Paraphrase the question]. ${sentence(p.position, "your position / thesis")}`,
    `Firstly, ${sentence(mid(p.body1), "main idea 1")} ${sentence(p.support1, "explanation and example")}`,
    `Secondly, ${sentence(mid(p.body2), "main idea 2")} ${sentence(p.support2, "explanation and example")}`,
    `In conclusion, ${sentence(mid(p.conclusion), "restate your position")}`,
  ].join("\n\n");
}

/** Paragraph skeletons built from the plan; empty fields become [placeholders] to replace. */
export function outlineFromPlan(ctx: WritingContext, plan: Plan): string {
  if (ctx.kind === "report") return reportOutline(plan);
  if (ctx.kind === "letter") return letterOutline(plan, ctx);
  return essayOutline(plan);
}
