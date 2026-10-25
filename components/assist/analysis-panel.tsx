import { Link2, Repeat, TriangleAlert } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { LONG_SENTENCE_WORDS, type WritingAnalysis } from "@/lib/writing/analyze";
import { LINK_FUNCTIONS } from "@/lib/writing/linking";
import { AnalysisChecklist } from "./analysis-checklist";
import { LinkingPreview } from "./linking-preview";
import { fill } from "./format";

interface AnalysisPanelProps {
  analysis: WritingAnalysis;
  /** The analysed text, for the linking-word preview. */
  text: string;
  labels: Dictionary["assist"];
}

/** Rule-based read of an answer. Server-safe: used live in practice and read-only on feedback. */
export function AnalysisPanel({ analysis: a, text, labels }: AnalysisPanelProps) {
  const t = labels.analysis;
  if (a.words === 0) return <p className="text-sm text-muted">{t.empty}</p>;
  const maxPara = Math.max(1, ...a.paragraphs.map((p) => p.words));

  return (
    <div className="flex flex-col gap-5" data-testid="writing-analysis">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure label={t.words} value={a.words} />
        <Figure label={t.paragraphs} value={a.paragraphs.length} />
        <Figure label={t.sentences} value={a.sentences} />
        <Figure label={t.avgSentence} value={fill(t.wordsShort, { n: a.avgSentenceLength })} />
      </dl>

      <section aria-label={t.paragraphs}>
        <ol className="flex flex-col gap-1">
          {a.paragraphs.map((p) => (
            <li key={p.index} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2 text-xs">
              <span className="text-muted">{fill(t.paragraph, { n: p.index + 1 })}</span>
              <span className="h-1.5 rounded-sm bg-surface-2" aria-hidden="true">
                <span className="block h-full rounded-sm bg-writing" style={{ width: `${(p.words / maxPara) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">{fill(t.wordsShort, { n: p.words })}</span>
            </li>
          ))}
        </ol>
        {a.longSentences > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-warning">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {fill(t.longWarning, { n: a.longSentences, max: LONG_SENTENCE_WORDS })}
          </p>
        )}
      </section>

      <AnalysisChecklist checks={a.checks} labels={labels.checks} title={t.checklist} />

      <section aria-labelledby="assist-linking">
        <h4 id="assist-linking" className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <Link2 size={15} className="text-writing" aria-hidden="true" />
          {t.linking}
        </h4>
        {a.linking.total === 0 ? (
          <p className="text-sm text-muted">{t.noLinking}</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-muted">{fill(t.linkingVariety, { distinct: a.linking.distinct, fns: a.linking.functionsUsed })}</p>
            <dl className="grid gap-1.5 text-sm sm:grid-cols-2">
              {LINK_FUNCTIONS.map((fn) => (
                <div key={fn} className="flex flex-wrap items-baseline gap-1.5">
                  <dt className={`text-xs ${a.linking.byFunction[fn].length > 0 ? "font-medium" : "text-muted"}`}>{t.functions[fn]}:</dt>
                  <dd className="flex flex-wrap gap-1">
                    {a.linking.byFunction[fn].length === 0 ? (
                      <span className="text-xs text-muted">—</span>
                    ) : (
                      a.linking.byFunction[fn].map((d) => (
                        <span key={d.phrase} className="rounded-sm bg-writing-soft px-1.5 py-0.5 text-xs">
                          <span>{d.phrase}</span>
                          {d.count > 1 && <span className="ml-1 tabular-nums text-muted">×{d.count}</span>}
                        </span>
                      ))
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium text-writing">{t.preview}</summary>
              <div className="mt-2">
                <LinkingPreview text={text} matches={a.linking.matches} functions={t.functions} />
              </div>
            </details>
          </>
        )}
      </section>

      <section aria-labelledby="assist-repeated">
        <h4 id="assist-repeated" className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
          <Repeat size={15} className="text-writing" aria-hidden="true" />
          {t.repeated}
        </h4>
        {a.repeated.length === 0 ? (
          <p className="text-sm text-muted">{t.noRepeats}</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-1.5 text-sm">
              {a.repeated.map((r) => (
                <li key={r.word} className="rounded-sm border border-border px-1.5 py-0.5">
                  <span>{r.word}</span> <span className="tabular-nums text-muted">×{r.count}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-muted">{t.repeatedHint}</p>
          </>
        )}
      </section>

      <p className="text-xs text-muted">{t.indicative}</p>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded bg-surface-2 p-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
