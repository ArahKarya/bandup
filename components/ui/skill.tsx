import { BookOpenText, Headphones, Mic, PenLine, SpellCheck, type LucideIcon } from "lucide-react";

/**
 * One colour and one icon per skill, used everywhere a skill appears (tiles, charts,
 * badges, the practice library) so learners can recognise it at a glance.
 */

export type SkillKey = "listening" | "reading" | "writing" | "speaking" | "grammar";

export const SKILL_META: Record<SkillKey, { icon: LucideIcon; text: string; bg: string; soft: string; border: string; cssVar: string }> = {
  listening: { icon: Headphones, text: "text-listening", bg: "bg-listening", soft: "bg-listening-soft", border: "border-listening", cssVar: "var(--listening)" },
  reading: { icon: BookOpenText, text: "text-reading", bg: "bg-reading", soft: "bg-reading-soft", border: "border-reading", cssVar: "var(--reading)" },
  writing: { icon: PenLine, text: "text-writing", bg: "bg-writing", soft: "bg-writing-soft", border: "border-writing", cssVar: "var(--writing)" },
  speaking: { icon: Mic, text: "text-speaking", bg: "bg-speaking", soft: "bg-speaking-soft", border: "border-speaking", cssVar: "var(--speaking)" },
  grammar: { icon: SpellCheck, text: "text-grammar", bg: "bg-grammar", soft: "bg-grammar-soft", border: "border-grammar", cssVar: "var(--grammar)" },
};

export function isSkillKey(v: unknown): v is SkillKey {
  return typeof v === "string" && v in SKILL_META;
}

/** The skill's icon on its soft colour. */
export function SkillIcon({ skill, size = "md", className = "" }: { skill: SkillKey; size?: "sm" | "md" | "lg"; className?: string }) {
  const meta = SKILL_META[skill];
  const Icon = meta.icon;
  const box = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-11 w-11" : "h-8 w-8";
  const icon = size === "sm" ? 14 : size === "lg" ? 22 : 17;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded ${box} ${meta.soft} ${meta.text} ${className}`} aria-hidden="true">
      <Icon size={icon} strokeWidth={2} />
    </span>
  );
}

/** Small coloured label: icon + skill name. */
export function SkillBadge({ skill, label }: { skill: SkillKey; label: string }) {
  const meta = SKILL_META[skill];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${meta.soft} ${meta.text}`}>
      <Icon size={12} strokeWidth={2.2} aria-hidden="true" />
      {label}
    </span>
  );
}
