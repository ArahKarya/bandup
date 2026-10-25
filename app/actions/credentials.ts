"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLearner } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { encryptionKey, providerConfig } from "@/lib/server/assess";
import { encryptSecret } from "@/lib/crypto/secret";
import { complete, ProviderError, safeBaseUrl } from "@/lib/ai/providers";
import { hit } from "@/lib/server/rate-limit";

export interface CredentialState {
  ok?: boolean;
  message?: string;
  error?: string;
}

const schema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  model: z.string().trim().min(1).max(100).regex(/^[\w.:/-]+$/, "Model names use letters, digits and . : / -"),
  apiKey: z.string().trim().max(500),
  baseUrl: z.string().trim().max(300).optional(),
});

export async function saveCredentialAction(_: CredentialState, form: FormData): Promise<CredentialState> {
  const user = await requireLearner();
  const parsed = schema.safeParse({
    provider: form.get("provider"),
    model: form.get("model"),
    apiKey: form.get("apiKey") ?? "",
    baseUrl: form.get("baseUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { provider, model, apiKey } = parsed.data;

  let baseUrl: string | null = null;
  if (provider === "openai" && parsed.data.baseUrl) {
    try {
      baseUrl = safeBaseUrl(parsed.data.baseUrl);
    } catch (e) {
      return { error: e instanceof ProviderError ? e.message : "Invalid base URL." };
    }
  }

  const existing = await db.apiCredential.findUnique({ where: { userId: user.id } });
  // An empty key field keeps the stored key, so changing the model does not mean re-pasting it.
  if (!apiKey && !existing) return { error: "Enter an API key." };

  const keyFields = apiKey ? { ciphertext: encryptSecret(apiKey, encryptionKey()), last4: apiKey.slice(-4) } : {};
  if (existing) {
    await db.apiCredential.update({ where: { userId: user.id }, data: { provider, model, baseUrl, ...keyFields } });
  } else {
    await db.apiCredential.create({ data: { userId: user.id, provider, model, baseUrl, ciphertext: keyFields.ciphertext!, last4: keyFields.last4! } });
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function removeCredentialAction(): Promise<void> {
  const user = await requireLearner();
  await db.apiCredential.deleteMany({ where: { userId: user.id } });
  revalidatePath("/settings");
}

/** A tiny round trip, so learners find out about a bad key before writing an essay. */
export async function testCredentialAction(): Promise<CredentialState> {
  const user = await requireLearner();
  if (!hit(`ai-test:${user.id}`, 10, 3_600_000)) return { error: "Too many tests. Try again later." };
  const config = await providerConfig(user.id);
  if (!config) return { error: "No key saved yet." };
  try {
    const reply = await complete(config, { system: "Reply with the single word OK.", user: "Ping" }, 10);
    return { ok: true, message: `Connected to ${config.model}: "${reply.trim().slice(0, 20)}"` };
  } catch (e) {
    return { error: e instanceof ProviderError ? e.message : "Could not reach the provider." };
  }
}
