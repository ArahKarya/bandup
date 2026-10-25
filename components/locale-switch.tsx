"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleCookie } from "@/app/actions/auth";

/** ID / EN toggle for visitors; signed-in users change language in Settings. */
export function LocaleSwitch({ locale }: { locale: "id" | "en" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex overflow-hidden rounded border border-border text-xs" aria-label="Language">
      {(["id", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          aria-pressed={locale === l}
          onClick={() => start(async () => { await setLocaleCookie(l); router.refresh(); })}
          className={`px-2 py-1 font-medium uppercase ${locale === l ? "bg-accent text-accent-fg" : "bg-surface text-muted hover:text-fg"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
