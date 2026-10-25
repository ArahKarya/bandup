"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, Trophy, X } from "lucide-react";

/**
 * Toasts: short confirmations ("Saved"), errors, and achievement unlocks. Client code calls
 * `useToast().show()`; server code that redirects can pass messages through the
 * `bandup_flash` cookie, which `FlashToasts` reads once and clears.
 */

export type ToastTone = "success" | "info" | "warning" | "achievement";

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

interface ToastApi {
  show: (t: Omit<ToastMessage, "id">) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = { success: CheckCircle2, info: Info, warning: TriangleAlert, achievement: Trophy } as const;
const TONES: Record<ToastTone, string> = {
  success: "text-success",
  info: "text-accent",
  warning: "text-warning",
  achievement: "text-warning",
};

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const show = useCallback(
    (t: Omit<ToastMessage, "id">) => {
      const id = ++seq;
      setItems((prev) => [...prev.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.tone === "achievement" ? 6000 : 3500);
    },
    [dismiss],
  );
  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" role="status">
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div key={t.id} className="animate-toast pointer-events-auto flex items-start gap-3 rounded border border-border bg-surface p-3 shadow-pop">
              <Icon size={20} className={`mt-0.5 shrink-0 ${TONES[t.tone]}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="text-muted hover:text-fg" aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  // Outside the provider (tests, isolated renders) toasts are silently dropped.
  return ctx ?? { show: () => undefined };
}

export const FLASH_COOKIE = "bandup_flash";

/** Shows messages handed over from the server via the flash cookie, then clears it. */
export function FlashToasts({ messages }: { messages: Omit<ToastMessage, "id">[] }) {
  const { show } = useToast();
  useEffect(() => {
    if (messages.length === 0) return;
    messages.forEach(show);
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
  }, [messages, show]);
  return null;
}
