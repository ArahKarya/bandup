"use client";

import { useEffect, useRef } from "react";

/** Elements that use the arrow keys themselves; plain ←/→ are left alone inside them. */
const OWNS_ARROWS = "input, textarea, select, [contenteditable=''], [contenteditable='true'], [role='tab'], [role='separator'], [role='slider'], [role='radiogroup'], [role='listbox'], [role='menu'], audio, video";

interface ExamKeys {
  onStep: (dir: 1 | -1) => void;
  onFlag: () => void;
}

/** ←/→ previous/following question, Alt+F flag the current one (Alt+H lives in Annotatable). */
export function useExamKeys(handlers: ExamKeys): void {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyF") {
        e.preventDefault();
        ref.current.onFlag();
        return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(OWNS_ARROWS)) return;
      // A text selection being extended or read should not jump questions.
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) return;
      e.preventDefault();
      ref.current.onStep(e.key === "ArrowRight" ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
