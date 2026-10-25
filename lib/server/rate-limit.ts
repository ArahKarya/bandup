import "server-only";

import { headers } from "next/headers";

/**
 * Fixed-window, in-memory rate limiter. Enough for a single-instance self-hosted app;
 * a multi-instance deployment should swap this for a shared store (Redis, Postgres).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  // Test-only escape hatch: the E2E suite registers many accounts from one address.
  if (process.env.DISABLE_RATE_LIMIT === "true") return true;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) sweep(now);
    return true;
  }
  if (bucket.count >= limit) return false;
  buckets.set(key, { ...bucket, count: bucket.count + 1 });
  return true;
}

function sweep(now: number): void {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

/**
 * Client address for rate limiting. X-Forwarded-For is client-controlled unless a proxy we
 * trust overwrites it, so it is only read when TRUSTED_PROXY_HOPS (the number of proxies in
 * front of the app, e.g. 1 behind Caddy/Nginx/Cloudflare Tunnel) is set; then the entry that
 * proxy appended is used, not the spoofable left-most one.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 0);
  if (hops > 0) {
    const chain = (h.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const ip = chain[chain.length - hops];
    if (ip) return ip;
  }
  // Without a trusted proxy the header is spoofable. It is still used (one shared bucket would
  // let a single attacker lock everyone out), so per-account limits are the real guard there.
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "direct";
}

/** True when the caller may proceed; scoped by action name and client IP. */
export async function allow(action: string, limit: number, windowMs: number): Promise<boolean> {
  return hit(`${action}:${await clientIp()}`, limit, windowMs);
}
