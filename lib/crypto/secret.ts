import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for user API keys at rest. The stored form is `v1.<iv>.<tag>.<ciphertext>`
 * (base64url), so the scheme can change later without a migration of old rows.
 */

const VERSION = "v1";

/** Accepts a 32-byte base64 key, or derives one from any other secret string. */
export function deriveKey(secret: string): Buffer {
  const decoded = Buffer.from(secret, "base64");
  if (decoded.length === 32) return decoded;
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(".");
}

export function decryptSecret(stored: string, secret: string): string {
  const [version, iv, tag, body] = stored.split(".");
  if (version !== VERSION || !iv || !tag || !body) throw new Error("Unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(secret), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

/** "sk-…abcd" for display; never show more than the last four characters. */
export function maskSecret(plain: string): string {
  return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`;
}
