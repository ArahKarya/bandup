"use client";

import { useEffect, useRef, useState } from "react";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { Button } from "@/components/ui";

interface NoteEditorProps {
  at: { x: number; y: number };
  initial: string;
  labels: ExamLabels;
  onSave: (text: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

const MAX_NOTE = 500;

/** A small floating editor for a passage note. */
export function NoteEditor({ at, initial, labels, onSave, onCancel, onDelete }: NoteEditorProps) {
  const [text, setText] = useState(initial);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    area.current?.focus();
  }, []);

  const save = () => {
    const trimmed = text.trim();
    if (trimmed) onSave(trimmed);
    else if (onDelete) onDelete();
    else onCancel();
  };

  return (
    <div
      role="dialog"
      aria-label={onDelete ? labels.editNote : labels.note}
      className="absolute z-40 w-64 max-w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-full rounded border border-border bg-surface p-2 font-sans shadow-pop"
      style={{ left: Math.max(136, at.x), top: at.y - 6 }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onCancel();
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
      }}
    >
      <textarea
        ref={area}
        rows={3}
        value={text}
        maxLength={MAX_NOTE}
        onChange={(e) => setText(e.target.value)}
        placeholder={labels.notePlaceholder}
        aria-label={labels.note}
        className="w-full rounded border border-border bg-surface p-2 text-sm text-fg placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <Button type="button" size="sm" onClick={save}>
          {labels.saveNote}
        </Button>
        {onDelete && (
          <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
            {labels.deleteNote}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onCancel}>
          {labels.close}
        </Button>
      </div>
    </div>
  );
}
