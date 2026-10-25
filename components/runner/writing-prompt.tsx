import type { WritingTask } from "@/lib/content/schema";
import { assetUrl } from "@/lib/content/assets";
import { TaskChart } from "@/components/charts/task-chart";

/** The task as the candidate sees it: instructions, then the chart, process or picture. */
export function WritingPrompt({ task }: { task: WritingTask }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="whitespace-pre-line rounded border border-border bg-surface-2 p-4 text-[0.95rem] leading-relaxed">{task.prompt}</div>
      {task.charts?.map((c, i) => <TaskChart key={i} spec={c} />)}
      {task.steps && task.steps.length > 0 && (
        <ol className="flex flex-col gap-0 rounded border border-border bg-surface p-4">
          {task.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-accent text-xs font-semibold text-accent-fg">{i + 1}</span>
                {i < task.steps!.length - 1 && <span className="my-0.5 w-px flex-1 bg-border" />}
              </div>
              <p className="pb-3 text-sm">{s}</p>
            </li>
          ))}
        </ol>
      )}
      {task.image && (
        // eslint-disable-next-line @next/next/no-img-element -- SVGs from content/assets
        <img src={assetUrl(task.image)} alt="Task illustration" className="w-full rounded border border-border bg-white object-contain p-2" />
      )}
    </div>
  );
}
