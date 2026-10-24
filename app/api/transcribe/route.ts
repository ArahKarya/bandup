import { currentUser } from "@/lib/server/auth";
import { providerConfig } from "@/lib/server/assess";
import { ProviderError, transcribe } from "@/lib/ai/providers";
import { hit } from "@/lib/server/rate-limit";
import { AUDIO_TYPES, MAX_AUDIO_BYTES, bodyTooLarge, json, looksLikeAudio, sameOrigin } from "@/lib/server/request";

/** Whisper-compatible transcription with the learner's own key. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (bodyTooLarge(req)) return json({ error: "Recording is too large" }, 413);
  if (!hit(`transcribe:${user.id}`, 30, 3_600_000)) return json({ error: "Hourly limit reached" }, 429);

  const config = await providerConfig(user.id);
  if (!config) return json({ error: "Add an AI key in Settings first." }, 400);

  const audio = (await req.formData()).get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return json({ error: "No recording" }, 400);
  if (audio.size > MAX_AUDIO_BYTES) return json({ error: "Recording is too large" }, 413);
  if (!AUDIO_TYPES.includes(audio.type.split(";")[0]) || !(await looksLikeAudio(audio))) return json({ error: "Unsupported audio type" }, 415);

  try {
    const text = await transcribe(config, audio, "answer.webm");
    return json({ text });
  } catch (e) {
    return json({ error: e instanceof ProviderError ? e.message : "Transcription failed" }, 502);
  }
}
