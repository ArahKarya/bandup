import type { Heatmap, HeatLevel } from "@/lib/stats/heatmap";
import { formatDay } from "@/lib/stats/dates";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Study-activity grid: weeks as columns, Monday at the top. Shades mix the accent into the
 * surface colour, so the ramp follows the theme. Every cell carries its date and minutes
 * as an accessible label and a native tooltip.
 */

const SHADE: Record<HeatLevel, string> = {
  0: "var(--surface-2)",
  1: "color-mix(in srgb, var(--accent) 28%, var(--surface-2))",
  2: "color-mix(in srgb, var(--accent) 52%, var(--surface-2))",
  3: "color-mix(in srgb, var(--accent) 76%, var(--surface-2))",
  4: "var(--accent)",
};

const LEVELS: readonly HeatLevel[] = [0, 1, 2, 3, 4];
/** Rows that get a weekday label (Mon, Wed, Fri) in the full-size grid. */
const LABELLED_ROWS = new Set([0, 2, 4]);

interface HeatmapProps {
  heatmap: Heatmap;
  t: Dictionary;
  locale: string;
  size?: "compact" | "full";
}

export function ActivityHeatmap({ heatmap, t, locale, size = "full" }: HeatmapProps) {
  const cell = size === "compact" ? 11 : 18;
  const gap = size === "compact" ? 3 : 4;
  // t.days starts on Sunday; the grid starts on Monday.
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((d) => t.days[d]);
  const h = t.motivation.heatmap;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={h.description}>
        {size === "full" && (
          <div className="flex shrink-0 flex-col text-[10px] leading-none text-muted" style={{ gap }} aria-hidden="true">
            {weekdays.map((d, i) => (
              <span key={d} className="flex items-center" style={{ height: cell }}>
                {LABELLED_ROWS.has(i) ? d : ""}
              </span>
            ))}
          </div>
        )}
        <div className="flex" style={{ gap }}>
          {heatmap.weeks.map((week) => (
            <div key={week[0].date} className="flex flex-col" style={{ gap }}>
              {week.map((c) => {
                const label = fmt(h.cell, { date: formatDay(c.date, locale), n: c.minutes });
                return (
                  <span
                    key={c.date}
                    role="img"
                    aria-label={c.future ? formatDay(c.date, locale) : label}
                    title={c.future ? undefined : label}
                    className={`block rounded-[2px] ${c.future ? "border border-dashed border-border" : ""}`}
                    style={{ width: cell, height: cell, background: c.future ? "transparent" : SHADE[c.level] }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="tabular-nums">{fmt(h.summary, { days: heatmap.activeDays, minutes: heatmap.totalMinutes })}</span>
        <span className="flex items-center gap-1" aria-hidden="true">
          {h.less}
          {LEVELS.map((l) => (
            <span key={l} className="block h-2.5 w-2.5 rounded-[2px]" style={{ background: SHADE[l] }} />
          ))}
          {h.more}
        </span>
      </div>
    </div>
  );
}
