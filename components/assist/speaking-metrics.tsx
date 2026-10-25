import { AudioLines, Gauge, Library, Repeat, Text } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { diversityLevel, fillerLevel, wpmLevel, type SpeakingMetrics } from "@/lib/speaking/metrics";
import { Card, Stat } from "@/components/ui";
import { fill } from "./format";

interface SpeakingMetricsPanelProps {
  metrics: SpeakingMetrics;
  labels: Dictionary["assist"]["speaking"];
}

const icon = (Icon: typeof Gauge) => <Icon size={18} className="text-speaking" aria-hidden="true" />;

/** Fluency and vocabulary indicators beside the recording, each tied to the criterion it informs. */
export function SpeakingMetricsPanel({ metrics: m, labels: t }: SpeakingMetricsPanelProps) {
  if (m.words === 0) {
    return (
      <Card className="p-5">
        <h3 className="mb-1 font-semibold">{t.title}</h3>
        <p className="text-sm text-muted">{t.empty}</p>
      </Card>
    );
  }
  const fillerHint = t.fillersHint[fillerLevel(m.fillers.per100Words) === "high" ? "high" : "ok"];
  const fillerList = m.fillers.items.map((f) => `${f.filler} ×${f.count}`).join(", ");
  return (
    <section aria-labelledby="speaking-metrics" className="flex flex-col gap-3" data-testid="speaking-metrics">
      <h3 id="speaking-metrics" className="font-semibold">{t.title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          label={t.wpm}
          icon={icon(Gauge)}
          value={m.wpm === null ? t.none : fill(t.wpmUnit, { n: m.wpm })}
          hint={m.wpm === null ? t.noDuration : t.wpmHint[wpmLevel(m.wpm)]}
        />
        <Stat
          label={t.fillers}
          icon={icon(AudioLines)}
          value={m.fillers.total}
          hint={[fill(t.fillersValue, { rate: m.fillers.per100Words }), fillerList, fillerHint].filter(Boolean).join(" · ")}
        />
        <Stat
          label={t.diversity}
          icon={icon(Library)}
          value={m.mattr === null ? t.none : m.mattr.toFixed(2)}
          hint={m.mattr === null ? undefined : `${fill(t.diversityValue, { ttr: (m.ttr ?? 0).toFixed(2) })} · ${t.diversityHint[diversityLevel(m.mattr)]}`}
        />
        <Stat
          label={t.sentences}
          icon={icon(Text)}
          value={m.avgSentenceLength === null ? t.none : fill(t.sentencesValue, { n: m.avgSentenceLength })}
        />
      </div>
      {m.repeated.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-sm">
          <Repeat size={15} className="text-speaking" aria-hidden="true" />
          <span className="text-muted">{t.repeated}:</span>
          {m.repeated.map((r) => (
            <span key={r.word} className="rounded-sm border border-border px-1.5 py-0.5">
              {r.word} <span className="tabular-nums text-muted">×{r.count}</span>
            </span>
          ))}
        </p>
      )}
      <p className="text-xs text-muted">{t.indicative}</p>
    </section>
  );
}
