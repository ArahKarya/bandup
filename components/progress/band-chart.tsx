"use client";

import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Skill } from "@/lib/plan/study-plan";
import type { TimelineRow } from "@/lib/stats/bands";
import { SKILL_COLORS, axisProps, tooltipStyle } from "./chart-theme";

interface BandChartProps {
  /** Rows with `date` already formatted for display. */
  rows: TimelineRow[];
  target: number;
  skillNames: Record<Skill, string>;
  targetLabel: string;
  description: string;
}

/** Dash pattern per skill, so lines stay distinguishable without relying on colour. */
const DASH: Record<Skill, string | undefined> = { listening: undefined, reading: "6 3", writing: "2 3", speaking: "8 3 2 3" };

export function BandChart({ rows, target, skillNames, targetLabel, description }: BandChartProps) {
  const skills = (Object.keys(SKILL_COLORS) as Skill[]).filter((s) => rows.some((r) => r[s] !== undefined));
  const low = Math.min(target, ...rows.flatMap((r) => skills.map((s) => r[s] ?? 9)));
  const floor = Math.max(0, Math.floor(low - 0.5));

  return (
    <div className="h-72 w-full" role="img" aria-label={description}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" {...axisProps} minTickGap={24} />
          <YAxis {...axisProps} width={36} domain={[floor, 9]} ticks={range(floor, 9)} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => (typeof v === "number" ? v.toFixed(1) : String(v))} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine
            y={target}
            stroke="var(--text-muted)"
            strokeDasharray="4 4"
            label={{ value: `${targetLabel} ${target.toFixed(1)}`, position: "insideTopRight", fontSize: 11, fill: "var(--text-muted)" }}
          />
          {skills.map((s) => (
            <Line
              key={s}
              type="linear"
              dataKey={s}
              name={skillNames[s]}
              stroke={SKILL_COLORS[s]}
              strokeWidth={2}
              strokeDasharray={DASH[s]}
              dot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)", fill: SKILL_COLORS[s] }}
              activeDot={{ r: 5 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
