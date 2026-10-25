import "server-only";

/**
 * Route handlers authenticate with the session cookie, so a cross-site form post would
 * carry it. SameSite=Lax already blocks that in modern browsers; checking Origin as well
 * closes the gap for older ones.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  // X-Forwarded-Host is only meaningful behind a proxy we trust to set it.
  const trusted = Number(process.env.TRUSTED_PROXY_HOPS ?? 0) > 0;
  const host = (trusted && req.headers.get("x-forwarded-host")) || req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

/**
 * Rejects oversized uploads before the body is read: route handlers have no built-in body
 * limit, and `formData()` buffers everything. Requests without Content-Length are refused.
 */
export function bodyTooLarge(req: Request, limit = MAX_AUDIO_BYTES + 64 * 1024): boolean {
  const length = Number(req.headers.get("content-length"));
  return !Number.isFinite(length) || length <= 0 || length > limit;
}

/** Checks the file's leading bytes, since the declared MIME type is client-controlled. */
export async function looksLikeAudio(blob: Blob): Promise<boolean> {
  const b = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  return (
    (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) || // WebM / Matroska
    ascii(0, 4) === "OggS" ||
    ascii(0, 4) === "RIFF" || // WAV
    ascii(4, 8) === "ftyp" || // MP4 / M4A
    ascii(0, 3) === "ID3" ||
    (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) // MPEG audio frame
  );
}
export const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav"];

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}
