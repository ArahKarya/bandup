"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AccuracyTone } from "@/lib/stats/accuracy";
import { TONE_COLORS, axisProps, tooltipStyle } from "./chart-theme";

export interface AccuracyRow {
  label: string;
  /** 0–100. */
  pct: number;
  correct: number;
  total: number;
  tone: AccuracyTone;
}

const ROW_HEIGHT = 32;

/** Horizontal bars, weakest first; the colour repeats what the % label already says. */
export function AccuracyChart({ rows, description }: { rows: AccuracyRow[]; description: string }) {
  return (
    <div className="w-full" style={{ height: rows.length * ROW_HEIGHT + 40 }} role="img" aria-label={description}>
      <ResponsiveContainer>
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }} barCategoryGap={6}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} {...axisProps} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="label" {...axisProps} width={140} interval={0} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: "var(--surface-2)" }}
            formatter={(_v, _n, item) => {
              const row = item.payload as AccuracyRow;
              return [`${row.pct}% (${row.correct}/${row.total})`, ""];
            }}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.label} fill={TONE_COLORS[r.tone]} />
            ))}
            <LabelList dataKey="pct" position="right" formatter={(v) => `${String(v)}%`} style={{ fontSize: 12, fill: "var(--text)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
