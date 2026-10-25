"use client";

import type { RefObject } from "react";
import { countWords } from "@/lib/content/check";

interface AssistedEditorProps {
  value: string;
  onChange: (v: string) => void;
  minWords: number;
  placeholder: string;
  label: string;
  wordsLabel: string;
  /** Lets the planner and phrase bank insert at the caret. */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

/**
 * The practice editor: same look and test-like settings as the runner's EssayEditor (spellcheck
 * off), plus a ref so assistant tools can insert text where the learner is typing.
 */
export function AssistedEditor({ value, onChange, minWords, placeholder, label, wordsLabel, textareaRef }: AssistedEditorProps) {
  const words = countWords(value);
  return (
    <div className="flex flex-1 flex-col gap-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={placeholder}
        maxLength={20_000}
        className="min-h-[420px] flex-1 resize-y rounded border border-border bg-surface p-4 font-serif text-[1.02rem] leading-relaxed focus:border-writing focus:outline-none"
      />
      <p className={`text-right text-sm tabular-nums ${words < minWords ? "text-muted" : "text-success"}`}>
        {words} {wordsLabel} / {minWords}+
      </p>
    </div>
  );
}
