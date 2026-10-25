import { BandValue, Badge, Card } from "@/components/ui";

/** Shows one stored score: band, criteria and (for AI) feedback. */

interface Feedback {
  summary?: string;
  strengths?: string[];
  improvements?: string[];
  corrections?: { original: string; suggestion: string; note?: string }[];
  notes?: string;
}

interface ScorePanelProps {
  band: number;
  source: "ai" | "self";
  model: string | null;
  createdAt: Date;
  criteria: Record<string, number>;
  /** Stored JSON; read defensively. */
  feedback: unknown;
  criteriaLabels: Record<string, string>;
  target?: number;
  labels: { strengths: string; improvements: string; corrections: string; ai: string; self: string };
  locale: string;
}

export function ScorePanel(props: ScorePanelProps) {
  const f = props.feedback && typeof props.feedback === "object" ? (props.feedback as Feedback) : null;
  const { labels } = props;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <BandValue band={props.band} target={props.target} size="lg" />
          <Badge tone={props.source === "ai" ? "accent" : "neutral"}>{props.source === "ai" ? labels.ai : labels.self}</Badge>
        </div>
        <span className="text-xs text-muted">
          {props.createdAt.toLocaleString(props.locale === "id" ? "id-ID" : "en-GB")}
          {props.model ? ` · ${props.model}` : ""}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* jsonb does not keep key order, so follow the rubric order of the labels. */}
        {Object.keys(props.criteriaLabels).filter((k) => k in props.criteria).map((k) => [k, props.criteria[k]] as const).map(([k, v]) => (
          <div key={k} className="rounded bg-surface-2 p-2">
            <dt className="text-xs text-muted">{props.criteriaLabels[k] ?? k}</dt>
            <dd className="font-semibold tabular-nums">{Number(v).toFixed(1)}</dd>
          </div>
        ))}
      </dl>

      {f?.summary && <p>{f.summary}</p>}
      {f?.notes && <p className="whitespace-pre-line text-sm text-muted">{f.notes}</p>}
      {f?.strengths && f.strengths.length > 0 && <List title={labels.strengths} items={f.strengths} tone="text-success" />}
      {f?.improvements && f.improvements.length > 0 && <List title={labels.improvements} items={f.improvements} tone="text-warning" />}
      {f?.corrections && f.corrections.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-semibold">{labels.corrections}</h4>
          <ul className="flex flex-col gap-2 text-sm">
            {f.corrections.map((c, i) => (
              <li key={i} className="rounded border border-border p-2">
                <span className="text-danger line-through">{c.original}</span> → <span className="font-medium text-success">{c.suggestion}</span>
                {c.note && <p className="mt-1 text-xs text-muted">{c.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div>
      <h4 className={`mb-1 text-sm font-semibold ${tone}`}>{title}</h4>
      <ul className="list-disc pl-5 text-sm">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
