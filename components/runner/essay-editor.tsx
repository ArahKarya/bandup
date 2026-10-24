"use client";

import { countWords } from "@/lib/content/check";

interface EssayEditorProps {
  value: string;
  onChange?: (v: string) => void;
  minWords: number;
  placeholder: string;
  wordsLabel: string;
}

/** Plain textarea with a live word count; spellcheck is off, as in the computer-delivered test. */
export function EssayEditor({ value, onChange, minWords, placeholder, wordsLabel }: EssayEditorProps) {
  const words = countWords(value);
  return (
    <div className="flex flex-1 flex-col gap-2">
      <textarea
        value={value}
        readOnly={!onChange}
        onChange={(e) => onChange?.(e.target.value)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={placeholder}
        maxLength={20_000}
        className="min-h-[420px] flex-1 resize-y rounded border border-border bg-surface p-4 font-serif text-[1.02rem] leading-relaxed focus:border-accent focus:outline-none"
      />
      <p className={`text-right text-sm tabular-nums ${words < minWords ? "text-muted" : "text-success"}`}>
        {words} {wordsLabel} / {minWords}+
      </p>
    </div>
  );
}
