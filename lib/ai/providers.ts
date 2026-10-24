import "server-only";

import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import type { Prompt } from "./prompts";

/**
 * Minimal clients for the two provider shapes BandUp supports, over plain fetch so the
 * app carries no SDK dependency. Keys belong to the learner and never leave the server.
 */

export type Provider = "anthropic" | "openai";

export interface ProviderConfig {
  provider: Provider;
  model: string;
  apiKey: string;
  /** OpenAI-compatible endpoints only (OpenAI, OpenRouter, Groq, a local Ollama…). */
  baseUrl?: string | null;
}

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-4.1-mini",
};

const TIMEOUT_MS = 90_000;

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  await assertPublicHost(url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // A redirect could point anywhere, including the internal network; providers never need one.
    redirect: "manual",
  });
  if (res.status >= 300 && res.status < 400) throw new ProviderError(`The provider redirected the request (HTTP ${res.status}).`, res.status);
  if (!res.ok) {
    // Never echo the provider's body verbatim: it can contain request details.
    const hint = res.status === 401 || res.status === 403 ? "The API key was rejected." : res.status === 429 ? "Rate limit or quota reached." : "The provider returned an error.";
    throw new ProviderError(`${hint} (HTTP ${res.status})`, res.status);
  }
  return res.json();
}

/** Address ranges a learner-supplied URL must never reach (unless the operator opts in). */
const BLOCKED_RANGES = new Set([
  "unspecified", "broadcast", "multicast", "linkLocal", "loopback", "carrierGradeNat", "private", "reserved",
  "uniqueLocal", "ipv4Mapped", "rfc6145", "rfc6052", "6to4", "teredo", "benchmarking", "amt", "as112", "as112v6", "orchid2", "deprecated",
]);

export function isPrivateAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return true;
  let ip = ipaddr.parse(address);
  // ::ffff:10.0.0.1 is 10.0.0.1 in disguise.
  if (ip.kind() === "ipv6" && (ip as ipaddr.IPv6).isIPv4MappedAddress()) ip = (ip as ipaddr.IPv6).toIPv4Address();
  return BLOCKED_RANGES.has(ip.range());
}

const allowPrivateDefault = () => process.env.AI_ALLOW_PRIVATE_BASE_URL === "true";

/**
 * Learners supply the base URL, so the server must not be steerable into its own network
 * (SSRF). This is the syntactic check, run when the URL is saved; `assertPublicHost` also
 * resolves DNS before every request. Private hosts — e.g. a local Ollama — are allowed only
 * when the operator sets AI_ALLOW_PRIVATE_BASE_URL=true, typically on a single-user install.
 */
export function safeBaseUrl(raw: string | null | undefined, allowPrivate = allowPrivateDefault()): string {
  let url: URL;
  try {
    url = new URL(raw || "https://api.openai.com/v1");
  } catch {
    throw new ProviderError("Base URL is not a valid URL.");
  }
  if (url.username || url.password) throw new ProviderError("Base URL must not contain credentials.");
  const host = url.hostname.replace(/\.$/, "").replace(/^\[|\]$/g, "");
  const literalPrivate = ipaddr.isValid(host) ? isPrivateAddress(host) : /^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host);
  if (literalPrivate && !allowPrivate) throw new ProviderError("Private or local addresses are not allowed on this server.");
  if (url.protocol !== "https:" && !(literalPrivate && url.protocol === "http:")) throw new ProviderError("Base URL must use https.");
  return url.toString().replace(/\/$/, "");
}

/** Resolves the host and refuses if any address is private (defeats DNS names like 127.0.0.1.nip.io). */
async function assertPublicHost(url: string): Promise<void> {
  if (allowPrivateDefault()) return;
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  const addresses = ipaddr.isValid(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new ProviderError("Could not resolve the provider host.");
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new ProviderError("Private or local addresses are not allowed on this server.");
}

export async function complete(config: ProviderConfig, prompt: Prompt, maxTokens = 2000): Promise<string> {
  if (config.provider === "anthropic") {
    const data = (await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
      { model: config.model, max_tokens: maxTokens, system: prompt.system, messages: [{ role: "user", content: prompt.user }] },
    )) as { content?: { type: string; text?: string }[] };
    return (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  }

  const data = (await post(
    `${safeBaseUrl(config.baseUrl)}/chat/completions`,
    { authorization: `Bearer ${config.apiKey}` },
    {
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
    },
  )) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Whisper-compatible transcription; OpenAI-compatible providers only. */
export async function transcribe(config: ProviderConfig, audio: Blob, filename: string): Promise<string> {
  if (config.provider !== "openai") throw new ProviderError("Automatic transcription needs an OpenAI-compatible provider.");
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-1");
  form.append("language", "en");
  const url = `${safeBaseUrl(config.baseUrl)}/audio/transcriptions`;
  await assertPublicHost(url);
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "manual",
  });
  if (!res.ok) throw new ProviderError(`Transcription failed (HTTP ${res.status})`, res.status);
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}
