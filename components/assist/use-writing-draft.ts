"use client";

import { useCallback, useEffect, useState } from "react";
import { parsePlan, type Plan } from "@/lib/writing/planner";

/** The essay draft key is unchanged from v0.1, so existing drafts survive the upgrade. */
const textKey = (id: string) => `bandup:draft:${id}`;
const planKey = (id: string) => `bandup:plan:${id}`;

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // storage may be unavailable (private mode); drafts are a convenience only
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // ignore: see read()
  }
}

function readPlan(id: string): Plan | null {
  const raw = read(planKey(id));
  if (!raw) return null;
  try {
    return parsePlan(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Essay text and plan, kept in localStorage per task so a refresh loses nothing. */
export function useWritingDraft(taskId: string, initialPlan: Plan) {
  const [text, setTextState] = useState("");
  const [plan, setPlanState] = useState<Plan>(initialPlan);

  useEffect(() => {
    // Restored after mount: the server render cannot know about a local draft.
    const restore = window.setTimeout(() => {
      const savedText = read(textKey(taskId));
      if (savedText) setTextState(savedText);
      const savedPlan = readPlan(taskId);
      if (savedPlan) setPlanState((p) => ({ ...p, ...savedPlan }));
    }, 0);
    return () => window.clearTimeout(restore);
  }, [taskId]);

  const setText = useCallback(
    (v: string) => {
      setTextState(v);
      write(textKey(taskId), v);
    },
    [taskId],
  );

  const setPlan = useCallback(
    (p: Plan) => {
      setPlanState(p);
      write(planKey(taskId), JSON.stringify(p));
    },
    [taskId],
  );

  const clear = useCallback(() => {
    write(textKey(taskId), null);
    write(planKey(taskId), null);
  }, [taskId]);

  return { text, setText, plan, setPlan, clear };
}

/** A value that settles `ms` after the last change, so heavy work does not run on every key. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return settled;
}
