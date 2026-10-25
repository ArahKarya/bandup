"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpenText, ChartNoAxesColumn } from "lucide-react";
import { submitWritingAction, type AssessState } from "@/app/actions/assess";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { countWords } from "@/lib/content/check";
import { analyzeWriting } from "@/lib/writing/analyze";
import { appendBlock, insertAtCursor, type InsertResult } from "@/lib/writing/insert";
import { initialPlan, outlineFromPlan } from "@/lib/writing/planner";
import { phraseBank } from "@/lib/writing/phrases";
import { LETTER_TONES, type LetterTone, type WritingContext } from "@/lib/writing/task-kind";
import { Alert, Button, Card } from "@/components/ui";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { AnalysisPanel } from "@/components/assist/analysis-panel";
import { AssistedEditor } from "@/components/assist/assisted-editor";
import { PhraseBank } from "@/components/assist/phrase-bank";
import { WritingPlanner } from "@/components/assist/writing-planner";
import { useDebounced, useWritingDraft } from "@/components/assist/use-writing-draft";

interface Props {
  taskId: string;
  minWords: number;
  minutes: number;
  context: WritingContext;
  /** The prompt column (instructions, chart, tips), rendered beside the editor. */
  prompt: ReactNode;
  labels: { placeholder: string; words: string; submit: string; tooShort: string; timeLeft: string };
  assist: Dictionary["assist"];
}

const ANALYSIS_DEBOUNCE_MS = 400;

function asTone(v: string | undefined): LetterTone | undefined {
  return (LETTER_TONES as readonly string[]).includes(v ?? "") ? (v as LetterTone) : undefined;
}

/** Practice editor with planner, live analysis and phrase bank, a soft countdown and a local draft. */
export function WritingPractice({ taskId, minWords, minutes, context, prompt, labels, assist }: Props) {
  const { text, setText, plan, setPlan, clear } = useWritingDraft(taskId, initialPlan(context));
  const [state, action, pending] = useActionState<AssessState, FormData>(submitWritingAction, {});
  const [elapsed, setElapsed] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingCaret = useRef<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    const tick = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(tick);
  }, []);

  // Put the caret back after an insertion once React has rendered the new value.
  useEffect(() => {
    const el = editorRef.current;
    if (el && pendingCaret.current !== null) {
      el.focus();
      el.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [text]);

  const settled = useDebounced(text, ANALYSIS_DEBOUNCE_MS);
  const analysis = useMemo(() => analyzeWriting(settled, context), [settled, context]);
  const groups = useMemo(() => phraseBank(context, asTone(plan.tone)), [context, plan.tone]);

  const apply = (r: InsertResult) => {
    pendingCaret.current = r.caret;
    setText(r.value);
  };

  const insertPhrase = (phrase: string) => {
    const el = editorRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    apply(insertAtCursor(text, start, end, phrase));
  };

  const insertOutline = () => {
    apply(appendBlock(text, outlineFromPlan(context, plan)));
    toast.show({ tone: "success", title: assist.planner.outlineInserted });
  };

  const left = Math.max(0, minutes * 60 - elapsed);
  const short = countWords(text) < minWords;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4 lg:col-start-1 lg:row-start-1">{prompt}</div>

      <form
        action={(fd) => {
          clear();
          return action(fd);
        }}
        className="flex flex-col gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <input type="hidden" name="taskId" value={taskId} />
        <input type="hidden" name="text" value={text} />
        <input type="hidden" name="durationSec" value={elapsed} />
        <div className="flex items-center justify-between text-sm">
          <span className={left === 0 ? "font-semibold text-danger" : "text-muted"}>
            {labels.timeLeft}: {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
        </div>
        <WritingPlanner kind={context.kind} plan={plan} onChange={setPlan} onUseOutline={insertOutline} labels={assist.planner} />
        <AssistedEditor
          value={text}
          onChange={setText}
          minWords={minWords}
          placeholder={labels.placeholder}
          label={labels.placeholder}
          wordsLabel={labels.words}
          textareaRef={editorRef}
        />
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        {short && text.trim() && <Alert tone="warning">{labels.tooShort}</Alert>}
        <div>
          <Button type="submit" disabled={pending || !text.trim()}>{labels.submit}</Button>
        </div>
      </form>

      <Card className="p-4 lg:col-start-1 lg:row-start-2 lg:self-start">
        <Tabs
          items={[
            {
              id: "analysis",
              label: (<><ChartNoAxesColumn size={15} aria-hidden="true" />{assist.tabs.analysis}</>),
              content: <AnalysisPanel analysis={analysis} text={settled} labels={assist} />,
            },
            {
              id: "phrases",
              label: (<><BookOpenText size={15} aria-hidden="true" />{assist.tabs.phrases}</>),
              content: <PhraseBank groups={groups} onInsert={insertPhrase} labels={assist.phrases} />,
            },
          ]}
        />
      </Card>
    </div>
  );
}
