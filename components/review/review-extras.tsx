"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { Star } from "lucide-react";
import { QuestionExtrasContext, type QuestionExtras } from "@/components/questions/question-group";
import { passageBlockId, scriptLineId } from "@/components/runner/passage";
import { useToast } from "@/components/ui/toast";
import { toggleBookmarkAction } from "@/app/actions/mistakes";
import { matchParagraph, parseEvidence } from "@/lib/mistakes/evidence";
import { questionRef } from "@/lib/mistakes/notebook";

export interface ReviewExtrasLabels {
  bookmark: string;
  unbookmark: string;
  bookmarked: string;
  unbookmarked: string;
  evidenceMissing: string;
  error: string;
}

interface ReviewExtrasProps {
  setId: string;
  /** Paragraph labels of the reading passage, in order; null for listening. */
  paragraphLabels: (string | null)[] | null;
  /** Question numbers already bookmarked. */
  bookmarked: number[];
  labels: ReviewExtrasLabels;
  children: ReactNode;
}

const FLASH_MS = 2400;

function evidenceElement(setId: string, evidence: string, paragraphLabels: (string | null)[] | null): HTMLElement | null {
  const target = parseEvidence(evidence);
  if (!target) return null;
  if (target.kind === "line") return document.getElementById(scriptLineId(setId, target.index));
  const index = paragraphLabels ? matchParagraph(paragraphLabels, target.label) : null;
  return index === null ? null : document.getElementById(passageBlockId(setId, index));
}

/** Opens the collapsed <details>, scrolls the paragraph or line into view and flashes it. */
function revealAndFlash(el: HTMLElement): void {
  const details = el.closest("details");
  if (details && !details.open) details.open = true;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  el.classList.remove("evidence-flash");
  // Restart the animation when the same evidence is clicked twice.
  void el.offsetWidth;
  el.classList.add("evidence-flash");
  window.setTimeout(() => el.classList.remove("evidence-flash"), FLASH_MS);
}

/**
 * Review-only decorations for one set's questions: a bookmark star under each number and
 * clickable "Where to find it" links.
 */
export function ReviewExtras({ setId, paragraphLabels, bookmarked, labels, children }: ReviewExtrasProps) {
  const [starred, setStarred] = useState<ReadonlySet<number>>(() => new Set(bookmarked));
  const [, startTransition] = useTransition();
  const { show } = useToast();

  const toggle = useCallback(
    (n: number) => {
      const was = starred.has(n);
      const flip = (on: boolean) =>
        setStarred((prev) => {
          const next = new Set(prev);
          if (on) next.add(n);
          else next.delete(n);
          return next;
        });
      flip(!was);
      startTransition(async () => {
        try {
          const res = await toggleBookmarkAction("question", questionRef(setId, n));
          if (!res.ok) throw new Error("bookmark failed");
          flip(res.bookmarked);
          show({ tone: "success", title: res.bookmarked ? labels.bookmarked : labels.unbookmarked });
        } catch {
          flip(was);
          show({ tone: "warning", title: labels.error });
        }
      });
    },
    [starred, setId, labels, show],
  );

  const onEvidence = useCallback(
    (evidence: string) => {
      const el = evidenceElement(setId, evidence, paragraphLabels);
      if (el) revealAndFlash(el);
      else show({ tone: "info", title: labels.evidenceMissing });
    },
    [setId, paragraphLabels, labels.evidenceMissing, show],
  );

  const extras = useMemo<QuestionExtras>(
    () => ({
      actions: (n) => <BookmarkStar on={starred.has(n)} n={n} labels={labels} onToggle={toggle} />,
      onEvidence,
    }),
    [starred, labels, toggle, onEvidence],
  );

  return <QuestionExtrasContext.Provider value={extras}>{children}</QuestionExtrasContext.Provider>;
}

function BookmarkStar({ on, n, labels, onToggle }: { on: boolean; n: number; labels: ReviewExtrasLabels; onToggle: (n: number) => void }) {
  const label = `${on ? labels.unbookmark : labels.bookmark} (${n})`;
  return (
    <button
      type="button"
      onClick={() => onToggle(n)}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={`inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-border hover:bg-surface-2 focus-visible:border-accent ${on ? "text-warning" : "text-muted"}`}
    >
      <Star size={15} fill={on ? "currentColor" : "none"} aria-hidden="true" />
    </button>
  );
}
