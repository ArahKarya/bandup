import type { QuestionSet } from "@/lib/content/schema";
import type { Annotation } from "@/lib/attempt/sections";
import type { GradedItem } from "@/lib/scoring/grade";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { getContent, questionCount } from "@/lib/server/content";
import { buildDrillSet } from "@/lib/content/drill";
import { groupLabels } from "@/lib/i18n/labels";
import { QuestionGroupView } from "@/components/questions/question-group";
import { Passage } from "@/components/runner/passage";
import { Card } from "@/components/ui";
import { ReviewExtras, type ReviewExtrasLabels } from "./review-extras";
import { ReviewTranscript } from "./review-transcript";

interface SetReviewProps {
  setId: string;
  items: GradedItem[];
  answers: Record<string, string | string[]>;
  annotations: Annotation[];
  bookmarked: number[];
  t: Dictionary;
}

export function extrasLabels(t: Dictionary): ReviewExtrasLabels {
  return {
    bookmark: t.mistakes.bookmark,
    unbookmark: t.mistakes.unbookmark,
    bookmarked: t.mistakes.bookmarked,
    unbookmarked: t.mistakes.unbookmarked,
    evidenceMissing: t.mistakes.evidenceMissing,
    error: t.common.error,
  };
}

/** One set on the results screen: passage or transcript beside the marked questions. */
export async function SetReview({ setId, items, answers, annotations, bookmarked, t }: SetReviewProps) {
  const full: QuestionSet | null = await getContent("question_set", setId);
  if (!full) return null;
  // Show exactly the questions that were asked (a drill asks a subset).
  const set = items.length < questionCount(full) ? buildDrillSet(full, items.map((i) => i.n)) : full;
  const results = new Map(items.map((i) => [i.n, i]));
  const raw = items.filter((i) => i.correct).length;
  const paragraphLabels = set.passage ? set.passage.paragraphs.map((p) => p.label ?? null) : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="font-semibold">{set.title}</h2>
        <span className="text-sm tabular-nums text-muted">
          {raw}/{items.length}
        </span>
      </div>
      <div className="grid lg:grid-cols-2">
        <details className="border-b border-border p-5 lg:border-r lg:border-b-0" open={Boolean(set.passage)}>
          <summary className="cursor-pointer text-sm font-medium text-accent">{set.passage ? set.passage.title : t.runner.transcript}</summary>
          <div className="mt-4 max-h-[70vh] overflow-y-auto">
            {set.passage && <Passage passage={set.passage} setId={setId} annotations={annotations} />}
            {set.audio && <ReviewTranscript setId={setId} script={set.audio.script} />}
          </div>
        </details>
        <div className="flex flex-col gap-8 p-5">
          <ReviewExtras setId={setId} paragraphLabels={paragraphLabels} bookmarked={bookmarked} labels={extrasLabels(t)}>
            {set.groups.map((g, i) => (
              <QuestionGroupView key={i} group={g} answers={answers} results={results} labels={groupLabels(t)} />
            ))}
          </ReviewExtras>
        </div>
      </div>
    </Card>
  );
}
