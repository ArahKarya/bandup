"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  initial?: string;
  /** Called when the active tab changes (e.g. to remember it). */
  onChange?: (id: string) => void;
  className?: string;
}

/**
 * Accessible tabs (WAI-ARIA pattern: arrow keys move between tabs). Underline style, square
 * corners — consistent with the rest of the UI. Inactive panels stay mounted so form input
 * in them survives switching.
 */
export function Tabs({ items, initial, onChange, className = "" }: TabsProps) {
  const [active, setActive] = useState(initial ?? items[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (id: string) => {
    setActive(id);
    onChange?.(id);
  };

  const onKey = (e: KeyboardEvent, index: number) => {
    const delta = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + items.length) % items.length;
    refs.current[next]?.focus();
    select(items[next].id);
  };

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
        {items.map((item, i) => (
          <button
            key={item.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${base}-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            aria-controls={`${base}-panel-${item.id}`}
            tabIndex={active === item.id ? 0 : -1}
            onClick={() => select(item.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${active === item.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {items.map((item) => (
        <div key={item.id} id={`${base}-panel-${item.id}`} role="tabpanel" aria-labelledby={`${base}-tab-${item.id}`} hidden={active !== item.id} className="pt-4">
          {item.content}
        </div>
      ))}
    </div>
  );
}
