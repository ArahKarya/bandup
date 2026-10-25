"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toggleBookmarkAction } from "@/app/actions/mistakes";
import { useToast } from "@/components/ui/toast";

export interface LessonBookmarkLabels {
  bookmark: string;
  unbookmark: string;
  bookmarked: string;
  unbookmarked: string;
  error: string;
}

/** Star toggle for a lesson; optimistic, rolled back with a toast if the save fails. */
export function LessonBookmarkStar({ lessonId, initial, labels }: { lessonId: string; initial: boolean; labels: LessonBookmarkLabels }) {
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();
  const { show } = useToast();

  const toggle = () => {
    const was = on;
    setOn(!was);
    startTransition(async () => {
      try {
        const res = await toggleBookmarkAction("lesson", lessonId);
        if (!res.ok) throw new Error("bookmark failed");
        setOn(res.bookmarked);
        show({ tone: "success", title: res.bookmarked ? labels.bookmarked : labels.unbookmarked });
      } catch {
        setOn(was);
        show({ tone: "warning", title: labels.error });
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      className={`inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-sm font-medium hover:bg-surface-2 ${on ? "border-warning text-warning" : "border-border text-muted"}`}
    >
      <Star size={15} fill={on ? "currentColor" : "none"} aria-hidden="true" />
      {on ? labels.unbookmark : labels.bookmark}
    </button>
  );
}
