"use client";

import { useEffect, useRef, useState } from "react";
import { Clock as ClockIcon } from "lucide-react";
import { formatClock } from "@/lib/exam/navigation";

interface ClockProps {
  deadline: string | null;
  startedAt: string;
  serverNow: string;
  minutes: number;
  label: string;
  onExpire: () => void;
}

/** Countdown to a deadline, or (practice) time spent against the recommended minutes. */
export function Clock({ deadline, startedAt, serverNow, minutes, label, onExpire }: ClockProps) {
  // Starts from the server's clock (identical on server and client, so no hydration
  // mismatch) and then advances by elapsed local time, which is immune to a wrong device clock.
  const [now, setNow] = useState(() => new Date(serverNow).getTime());
  const fired = useRef(false);

  useEffect(() => {
    const base = new Date(serverNow).getTime();
    const mountedAt = performance.now();
    const t = window.setInterval(() => setNow(base + (performance.now() - mountedAt)), 1000);
    return () => window.clearInterval(t);
  }, [serverNow]);

  const remaining = deadline ? new Date(deadline).getTime() - now : null;
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !fired.current) {
      fired.current = true;
      onExpire();
    }
  }, [remaining, onExpire]);

  if (remaining !== null) {
    const s = Math.max(0, Math.floor(remaining / 1000));
    const low = s < 5 * 60;
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-sm font-semibold tabular-nums ${low ? "border-danger text-danger" : "border-border"}`}
        aria-label={`${label}: ${formatClock(s)}`}
        role="timer"
      >
        <ClockIcon size={14} aria-hidden="true" />
        {formatClock(s)}
      </span>
    );
  }

  const spent = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm tabular-nums ${spent > minutes * 60 ? "text-warning" : "text-muted"}`}>
      <ClockIcon size={14} aria-hidden="true" />
      {formatClock(spent)} / {minutes}:00
    </span>
  );
}
