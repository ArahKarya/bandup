"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartSpec } from "@/lib/content/schema";

/** Draws a Writing Task 1 chart from its data, so tasks need no image files. */

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "#7a7f85", "#b04a8c"];

const axisProps = { stroke: "var(--text-muted)", fontSize: 12, tickLine: false } as const;
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4, fontSize: 12 };

export function TaskChart({ spec }: { spec: ChartSpec }) {
  return (
    <figure className="rounded border border-border bg-surface p-4">
      <figcaption className="mb-3 text-center text-sm font-semibold">
        {spec.title}
        {spec.unit && <span className="font-normal text-muted"> ({spec.unit})</span>}
      </figcaption>
      {spec.type === "table" ? <DataTable spec={spec} /> : <div className="h-72 w-full">{renderChart(spec)}</div>}
    </figure>
  );
}

function rows(spec: ChartSpec) {
  return spec.categories.map((c, i) => ({ name: c, ...Object.fromEntries(spec.series.map((s) => [s.name, s.values[i]])) }));
}

function renderChart(spec: ChartSpec) {
  if (spec.type === "pie") {
    // One pie per series, side by side ("2000" and "2025").
    return (
      <ResponsiveContainer>
        <PieChart>
          {spec.series.map((s, si) => {
            const width = 100 / spec.series.length;
            return (
              <Pie
                key={s.name}
                data={spec.categories.map((c, i) => ({ name: c, value: s.values[i] }))}
                dataKey="value"
                nameKey="name"
                cx={`${width * si + width / 2}%`}
                cy="45%"
                outerRadius={spec.series.length > 1 ? "55%" : "70%"}
                label={({ value }) => `${value}${spec.unit === "%" ? "%" : ""}`}
                isAnimationActive={false}
              >
                {spec.categories.map((c, i) => (
                  <Cell key={c} fill={COLORS[i % COLORS.length]} stroke="var(--surface)" />
                ))}
              </Pie>
            );
          })}
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const Chart = spec.type === "line" ? LineChart : BarChart;
  return (
    <ResponsiveContainer>
      <Chart data={rows(spec)} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis dataKey="name" {...axisProps} label={spec.xLabel ? { value: spec.xLabel, position: "insideBottom", offset: -2, fontSize: 12 } : undefined} />
        <YAxis {...axisProps} width={48} label={spec.yLabel ? { value: spec.yLabel, angle: -90, position: "insideLeft", fontSize: 12 } : undefined} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {spec.series.map((s, i) =>
          spec.type === "line" ? (
            <Line key={s.name} type="linear" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          ) : (
            <Bar key={s.name} dataKey={s.name} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          ),
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

function DataTable({ spec }: { spec: ChartSpec }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-border bg-surface-2 px-2 py-1.5 text-left" />
            {spec.series.map((s) => (
              <th key={s.name} className="border border-border bg-surface-2 px-2 py-1.5 text-right font-semibold">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.categories.map((c, i) => (
            <tr key={c}>
              <th className="border border-border px-2 py-1.5 text-left font-medium">{c}</th>
              {spec.series.map((s) => (
                <td key={s.name} className="border border-border px-2 py-1.5 text-right tabular-nums">
                  {s.values[i]?.toLocaleString("en-GB")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
