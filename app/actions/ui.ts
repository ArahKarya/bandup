"use server";

import { cookies } from "next/headers";
import { THEME_COOKIE } from "@/lib/server/ui-prefs";

export async function setThemeAction(theme: string): Promise<void> {
  const store = await cookies();
  if (theme === "light" || theme === "dark") store.set(THEME_COOKIE, theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  else store.delete(THEME_COOKIE);
}
