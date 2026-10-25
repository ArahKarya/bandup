"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisProps, tooltipStyle } from "./chart-theme";

export interface WeekRow {
  /** Week start, formatted for display. */
  label: string;
  minutes: number;
}

export function StudyTimeChart({ rows, minutesLabel, description }: { rows: WeekRow[]; minutesLabel: string; description: string }) {
  return (
    <div className="h-60 w-full" role="img" aria-label={description}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
          <YAxis {...axisProps} width={40} allowDecimals={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => [String(v), minutesLabel]} />
          <Bar dataKey="minutes" name={minutesLabel} fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
