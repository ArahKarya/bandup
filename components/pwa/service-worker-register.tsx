"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production builds only — in development a cached shell would hide
 * fresh code. Registration failing (private mode, old browser) just means no offline page.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
  }, []);
  return null;
}
