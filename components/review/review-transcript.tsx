import type { QuestionSet } from "@/lib/content/schema";
import { scriptLineId } from "@/components/runner/passage";

type Line = NonNullable<QuestionSet["audio"]>["script"][number];

/** Read-only listening script for the review, with line ids so evidence links can reach them. */
export function ReviewTranscript({ setId, script }: { setId: string; script: Line[] }) {
  return (
    <ol className="rounded border border-border bg-surface p-3 text-sm">
      {script.map((line, i) => (
        <li key={i} id={scriptLineId(setId, i)} data-line={i + 1} className="flex scroll-mt-24 gap-2 rounded px-1 py-0.5">
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted">{i + 1}</span>
          <span>
            <strong>{line.speaker}:</strong> {line.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
