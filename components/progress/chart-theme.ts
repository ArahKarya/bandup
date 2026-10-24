/** Shared recharts styling, all from CSS tokens so charts follow light/dark mode. */

export const axisProps = { stroke: "var(--text-muted)", fontSize: 12, tickLine: false } as const;

export const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  fontSize: 12,
  color: "var(--text)",
} as const;

/** Fixed skill → colour mapping, so a skill keeps its colour whichever skills have data. */
export const SKILL_COLORS = {
  listening: "var(--chart-1)",
  reading: "var(--chart-2)",
  writing: "var(--chart-3)",
  speaking: "var(--chart-4)",
} as const;

export const TONE_COLORS = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
} as const;
