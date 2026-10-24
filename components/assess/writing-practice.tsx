"use client";

import { useActionState, useEffect, useState } from "react";
import { submitWritingAction, type AssessState } from "@/app/actions/assess";
import { EssayEditor } from "@/components/runner/essay-editor";
import { Alert, Button } from "@/components/ui";
import { countWords } from "@/lib/content/check";

interface Props {
  taskId: string;
  minWords: number;
  minutes: number;
  labels: { placeholder: string; words: string; submit: string; tooShort: string; timeLeft: string };
}

const draftKey = (id: string) => `bandup:draft:${id}`;

/** Practice editor with a soft countdown and a local draft, so a refresh loses nothing. */
export function WritingPractice({ taskId, minWords, minutes, labels }: Props) {
  const [text, setText] = useState("");
  const [state, action, pending] = useActionState<AssessState, FormData>(submitWritingAction, {});
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Restored after mount: the server render cannot know about a local draft.
    const restore = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(draftKey(taskId));
        if (saved) setText(saved);
      } catch {
        // storage may be unavailable (private mode); drafts are a convenience only
      }
    }, 0);
    const tick = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      window.clearTimeout(restore);
      window.clearInterval(tick);
    };
  }, [taskId]);

  const update = (v: string) => {
    setText(v);
    try {
      window.localStorage.setItem(draftKey(taskId), v);
    } catch {
      // ignore
    }
  };

  const left = Math.max(0, minutes * 60 - elapsed);
  const short = countWords(text) < minWords;

  return (
    <form
      action={(fd) => {
        try {
          window.localStorage.removeItem(draftKey(taskId));
        } catch {
          // ignore
        }
        return action(fd);
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="text" value={text} />
      <input type="hidden" name="durationSec" value={elapsed} />
      <div className="flex items-center justify-between text-sm">
        <span className={left === 0 ? "font-semibold text-danger" : "text-muted"}>
          {labels.timeLeft}: {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </span>
      </div>
      <EssayEditor value={text} onChange={update} minWords={minWords} placeholder={labels.placeholder} wordsLabel={labels.words} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {short && text.trim() && <Alert tone="warning">{labels.tooShort}</Alert>}
      <div>
        <Button type="submit" disabled={pending || !text.trim()}>{labels.submit}</Button>
      </div>
    </form>
  );
}
