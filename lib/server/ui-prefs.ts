import "server-only";

import { cookies } from "next/headers";
import { FLASH_COOKIE, type ToastMessage } from "@/components/ui/toast";

export type Theme = "light" | "dark" | "system";
export const THEME_COOKIE = "bandup_theme";

/** Theme is a cookie so the server renders the right `data-theme` and nothing flashes. */
export async function getTheme(): Promise<Theme> {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return v === "light" || v === "dark" ? v : "system";
}

type Flash = Omit<ToastMessage, "id">;

/** Queues a toast to show after a redirect (read by FlashToasts in the root layout). */
export async function flash(message: Flash): Promise<void> {
  const store = await cookies();
  const queue = [...(await readFlash()), message].slice(-4);
  store.set(FLASH_COOKIE, encodeURIComponent(JSON.stringify(queue)), { path: "/", sameSite: "lax", maxAge: 60 });
}

export async function readFlash(): Promise<Flash[]> {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((m): m is Flash => !!m && typeof m === "object" && typeof (m as Flash).title === "string")
      .map((m) => ({ tone: (["success", "info", "warning", "achievement"] as const).includes(m.tone) ? m.tone : "info", title: m.title.slice(0, 120), body: m.body?.slice(0, 240) }));
  } catch {
    return [];
  }
}
