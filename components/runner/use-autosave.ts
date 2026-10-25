"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAttemptAction } from "@/app/actions/attempts";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Payload {
  attemptId: string;
  section: number;
  answers?: Record<string, unknown>;
  essays?: Record<string, unknown>;
  /** Whole highlight/note list per set. */
  annotations?: Record<string, unknown>;
  /** Flagged question numbers per set. */
  flags?: Record<string, unknown>;
}

/**
 * Saves the runner state two seconds after the last change and at least every ten seconds
 * while dirty. If the server reports the section closed (deadline passed), the page reloads.
 */
export function useAutosave(build: () => Payload, dirtyKey: unknown) {
  const router = useRouter();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const dirty = useRef(false);
  const buildRef = useRef(build);
  const first = useRef(true);

  useEffect(() => {
    buildRef.current = build;
  });

  const flush = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setStatus("saving");
    try {
      const res = await saveAttemptAction(buildRef.current());
      setStatus(res.ok ? "saved" : "error");
      if (res.advanced) router.refresh();
    } catch {
      dirty.current = true;
      setStatus("error");
    }
  }, [router]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
    const t = window.setTimeout(() => void flush(), 2000);
    return () => window.clearTimeout(t);
  }, [dirtyKey, flush]);

  useEffect(() => {
    const t = window.setInterval(() => void flush(), 10_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  return { status, flush };
}
