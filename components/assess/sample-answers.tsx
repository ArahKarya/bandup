import type { WritingTask } from "@/lib/content/schema";
import { Badge } from "@/components/ui";

/** Model answers at several bands, shown only after the learner has answered. */
export function SampleAnswers({ samples, title }: { samples: WritingTask["samples"]; title: string }) {
  if (samples.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-semibold">{title}</h3>
      {[...samples].sort((a, b) => a.band - b.band).map((s, i) => (
        <details key={i} className="rounded border border-border bg-surface">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
            <Badge tone="accent">Band {s.band}</Badge>
          </summary>
          <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
            <p className="whitespace-pre-line font-serif leading-relaxed">{s.text}</p>
            <p className="rounded bg-surface-2 p-3 text-sm text-muted">{s.commentary}</p>
          </div>
        </details>
      ))}
    </section>
  );
}
