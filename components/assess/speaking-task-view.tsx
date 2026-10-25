import type { SpeakingTask } from "@/lib/content/schema";

/** What the examiner asks: the question list (Parts 1 and 3) or the cue card (Part 2). */
export function SpeakingTaskView({ task }: { task: SpeakingTask }) {
  if (task.cueCard) {
    return (
      <div className="rounded border-2 border-fg/80 bg-surface p-5">
        <p className="font-semibold">{task.cueCard.prompt}</p>
        <p className="mt-3 text-sm">You should say:</p>
        <ul className="mt-1 list-disc pl-5">
          {task.cueCard.bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
        <p className="mt-2">{task.cueCard.closing}</p>
      </div>
    );
  }
  return (
    <ol className="flex list-decimal flex-col gap-2 rounded border border-border bg-surface p-5 pl-9">
      {task.questions.map((q, i) => <li key={i}>{q}</li>)}
    </ol>
  );
}
