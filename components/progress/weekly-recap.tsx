import { CalendarCheck, Clock, Gauge, ListChecks, Target } from "lucide-react";
import type { WeeklyRecap } from "@/lib/stats/recap";
import { addDays, formatDay } from "@/lib/stats/dates";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui";

/** Four headline numbers for one week, each with its change against the week before. */

interface RecapProps {
  recap: WeeklyRecap;
  title: string;
  t: Dictionary;
  locale: string;
}

function Delta({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null || value === 0) return <span className="text-muted">±0{suffix}</span>;
  const tone = value > 0 ? "text-success" : "text-danger";
  return (
    <span className={`font-medium tabular-nums ${tone}`}>
      {value > 0 ? "+" : "−"}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

export function WeeklyRecapCard({ recap, title, t, locale }: RecapProps) {
  const r = t.motivation.recap;
  const start = new Date(`${recap.weekStart}T00:00:00Z`);
  const range = `${formatDay(start, locale, false)} – ${formatDay(addDays(start, 6), locale, false)}`;
  const empty = recap.minutes === 0 && recap.sets === 0;
  const items = [
    { label: r.minutes, icon: Clock, value: String(recap.minutes), delta: <Delta value={recap.minutesDelta} /> },
    { label: r.sets, icon: ListChecks, value: String(recap.sets), delta: <Delta value={recap.setsDelta} /> },
    {
      label: r.accuracy,
      icon: Target,
      value: recap.accuracy === null ? t.common.none : `${Math.round(recap.accuracy * 100)}%`,
      delta: <Delta value={recap.accuracyDelta} suffix=" pp" />,
    },
    {
      label: r.band,
      icon: Gauge,
      value: recap.bandChange === null ? t.common.none : `${recap.bandChange > 0 ? "+" : ""}${recap.bandChange.toFixed(1)}`,
      delta: null,
    },
  ];

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <CalendarCheck size={18} className="text-accent" aria-hidden="true" />
          {title}
        </h3>
        <span className="text-xs text-muted">{fmt(r.weekOf, { date: range })}</span>
      </div>
      {empty ? (
        <p className="text-sm text-muted">{r.empty}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {items.map(({ label, icon: Icon, value, delta }) => (
            <div key={label} className="flex flex-col gap-1">
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <Icon size={14} aria-hidden="true" />
                {label}
              </dt>
              <dd className="text-xl font-semibold tabular-nums">{value}</dd>
              {delta && (
                <dd className="text-xs">
                  {delta} <span className="text-muted">{r.vsPrev}</span>
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
