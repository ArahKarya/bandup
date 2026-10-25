"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Highlighter, StickyNote, Eraser } from "lucide-react";
import type { Annotation } from "@/lib/attempt/sections";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import { addHighlight, addNote, byBlock, removeAnnotation, removeRange, splitSelection, updateNote, type BlockRange } from "@/lib/exam/annotations";
import { renderAnnotated } from "./annotated-text";
import { NoteEditor } from "./note-editor";

type RenderText = (text: string, block: number) => ReactNode;

interface AnnotatableProps {
  annotations: readonly Annotation[];
  onChange: (next: Annotation[]) => void;
  labels: ExamLabels;
  children: (renderText: RenderText) => ReactNode;
  className?: string;
}

interface Point {
  x: number;
  y: number;
}

type Tool =
  | { kind: "selection"; ranges: BlockRange[]; at: Point }
  | { kind: "highlight"; id: string; at: Point }
  | { kind: "note"; ranges: BlockRange[]; at: Point }
  | { kind: "edit"; id: string; at: Point };

export function newAnnotationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Position of a rect relative to the annotatable container, for the floating tools. */
function pointFrom(rect: DOMRect, container: Element | null): Point {
  const box = container?.getBoundingClientRect();
  return { x: rect.left - (box?.left ?? 0) + rect.width / 2, y: rect.top - (box?.top ?? 0) };
}

const ROOT_ATTR = "data-annotatable";

/** Block elements are the `[data-block-text]` spans that Passage and Transcript render. */
function blockOf(el: Element): number {
  return Number(el.getAttribute("data-block-text"));
}

/** Offset of a DOM point inside a block, counted on the block's plain text. */
function offsetIn(block: Element, node: Node, offset: number): number {
  const r = document.createRange();
  r.selectNodeContents(block);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** Turns the current selection into per-block ranges, if it lies (partly) inside `root`. */
function readSelection(root: HTMLElement): { ranges: BlockRange[]; rect: DOMRect } | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const blocks = [...root.querySelectorAll("[data-block-text]")].filter((el) => range.intersectsNode(el));
  if (blocks.length === 0) return null;
  const texts = new Map(blocks.map((el) => [blockOf(el), el.textContent ?? ""]));
  const first = blocks[0];
  const last = blocks[blocks.length - 1];
  const from = { block: blockOf(first), offset: first.contains(range.startContainer) ? offsetIn(first, range.startContainer, range.startOffset) : 0 };
  const to = { block: blockOf(last), offset: last.contains(range.endContainer) ? offsetIn(last, range.endContainer, range.endOffset) : (last.textContent ?? "").length };
  const ranges = splitSelection(texts, from, to);
  return ranges.length ? { ranges, rect: range.getBoundingClientRect() } : null;
}

/**
 * Wraps a passage or transcript: selecting text shows a small toolbar (Highlight / Note /
 * Remove); notes open an editor on click. Alt+H highlights the current selection.
 */
export function Annotatable({ annotations, onChange, labels, children, className = "" }: AnnotatableProps) {
  const root = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool | null>(null);

  const refresh = useCallback(() => {
    if (!root.current) return;
    const found = readSelection(root.current);
    setTool((t) => {
      if (t?.kind === "note" || t?.kind === "edit") return t;
      if (found) return { kind: "selection", ranges: found.ranges, at: pointFrom(found.rect, root.current) };
      return t?.kind === "highlight" ? t : null;
    });
  }, []);

  useEffect(() => {
    let timer = 0;
    const onChangeSel = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(refresh, 200);
    };
    document.addEventListener("selectionchange", onChangeSel);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("selectionchange", onChangeSel);
    };
  }, [refresh]);

  const clearSelection = () => window.getSelection()?.removeAllRanges();

  const apply = useCallback(
    (kind: "hl" | "remove", ranges: BlockRange[]) => {
      let next: Annotation[] = [...annotations];
      for (const r of ranges) next = kind === "hl" ? addHighlight(next, r, newAnnotationId()) : removeRange(next, r, newAnnotationId);
      onChange(next);
      clearSelection();
      setTool(null);
    },
    [annotations, onChange],
  );

  // Alt+H highlights the selection (e.code, since Alt changes the character on macOS).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.code !== "KeyH" || !root.current) return;
      const found = readSelection(root.current);
      if (!found) return;
      e.preventDefault();
      apply("hl", found.ranges);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [apply]);

  const grouped = useMemo(() => byBlock(annotations), [annotations]);
  const renderText = useCallback<RenderText>(
    (text, block) =>
      renderAnnotated(text, grouped.get(block), {
        editLabel: labels.editNote,
        onNote: (a, el) => setTool({ kind: "edit", id: a.id, at: pointFrom(el.getBoundingClientRect(), el.closest(`[${ROOT_ATTR}]`)) }),
        onHighlight: (a, el) => setTool({ kind: "highlight", id: a.id, at: pointFrom(el.getBoundingClientRect(), el.closest(`[${ROOT_ATTR}]`)) }),
      }),
    [grouped, labels.editNote],
  );

  const editing = tool?.kind === "edit" ? annotations.find((a) => a.id === tool.id) : undefined;

  return (
    <div
      ref={root}
      {...{ [ROOT_ATTR]: "" }}
      className={`relative ${className}`}
      onPointerUp={() => window.setTimeout(refresh, 0)}
      onKeyUp={(e) => e.shiftKey && refresh()}
    >
      {children(renderText)}

      {(tool?.kind === "selection" || tool?.kind === "highlight") && (
        <div
          role="toolbar"
          aria-label={labels.annotationTools}
          className="absolute z-30 flex -translate-x-1/2 -translate-y-full gap-0.5 rounded border border-border bg-surface p-0.5 font-sans shadow-pop"
          style={{ left: Math.max(60, tool.at.x), top: tool.at.y - 6 }}
          onMouseDown={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "Escape") setTool(null);
          }}
        >
          {tool.kind === "selection" && (
            <>
              <ToolButton icon={<Highlighter size={15} />} label={labels.highlight} onClick={() => apply("hl", tool.ranges)} />
              <ToolButton icon={<StickyNote size={15} />} label={labels.note} onClick={() => setTool({ kind: "note", ranges: tool.ranges, at: tool.at })} />
            </>
          )}
          <ToolButton
            icon={<Eraser size={15} />}
            label={labels.removeMark}
            onClick={() => {
              if (tool.kind === "selection") apply("remove", tool.ranges);
              else {
                onChange(removeAnnotation(annotations, tool.id));
                setTool(null);
              }
            }}
          />
        </div>
      )}

      {tool?.kind === "note" && (
        <NoteEditor
          at={tool.at}
          initial=""
          labels={labels}
          onCancel={() => setTool(null)}
          onSave={(text) => {
            let next: Annotation[] = [...annotations];
            for (const r of tool.ranges) next = addNote(next, r, text, newAnnotationId());
            onChange(next);
            clearSelection();
            setTool(null);
          }}
        />
      )}

      {tool?.kind === "edit" && editing && (
        <NoteEditor
          at={tool.at}
          initial={editing.note ?? ""}
          labels={labels}
          onCancel={() => setTool(null)}
          onDelete={() => {
            onChange(removeAnnotation(annotations, editing.id));
            setTool(null);
          }}
          onSave={(text) => {
            onChange(updateNote(annotations, editing.id, text));
            setTool(null);
          }}
        />
      )}
    </div>
  );
}

function ToolButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs font-medium text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}
