import { z } from "zod";
import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getContent } from "@/lib/server/content";
import { logStudy } from "@/lib/server/attempts";
import { audioPath, saveFile } from "@/lib/server/storage";
import { AUDIO_TYPES, MAX_AUDIO_BYTES, bodyTooLarge, json, looksLikeAudio, sameOrigin } from "@/lib/server/request";
import { hit } from "@/lib/server/rate-limit";

/** Per-learner cap on kept recordings (~15 MB each at most). */
const MAX_STORED_RECORDINGS = Number(process.env.MAX_STORED_RECORDINGS ?? 100);

const fields = z.object({
  taskId: z.string().regex(/^[a-z0-9-]{1,80}$/),
  attemptId: z.string().max(40).optional(),
  transcript: z.string().max(20_000).default(""),
  durationSec: z.coerce.number().int().min(0).max(3600),
  keepAudio: z.enum(["true", "false"]).default("false"),
});

/** Creates a speaking submission: transcript, duration and (optionally) the recording. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Forbidden" }, 403);
  const user = await currentUser();
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (bodyTooLarge(req)) return json({ error: "Recording is too large" }, 413);
  if (!hit(`speaking:${user.id}`, 40, 3_600_000)) return json({ error: "Hourly limit reached" }, 429);

  const form = await req.formData();
  const parsed = fields.safeParse({
    taskId: form.get("taskId"),
    attemptId: form.get("attemptId") || undefined,
    transcript: form.get("transcript") ?? "",
    durationSec: form.get("durationSec"),
    keepAudio: form.get("keepAudio") ?? "false",
  });
  if (!parsed.success) return json({ error: "Invalid submission" }, 400);

  const task = await getContent("speaking_task", parsed.data.taskId);
  if (!task) return json({ error: "Task not found" }, 404);

  // Only link to the learner's own, still-open mock attempt.
  const attempt = parsed.data.attemptId
    ? await db.attempt.findFirst({ where: { id: parsed.data.attemptId, userId: user.id, mode: "mock", status: "in_progress" } })
    : null;

  const audio = form.get("audio");
  const keep = parsed.data.keepAudio === "true" && audio instanceof Blob && audio.size > 0;
  if (keep) {
    if (audio.size > MAX_AUDIO_BYTES) return json({ error: "Recording is too large" }, 413);
    if (!AUDIO_TYPES.includes(audio.type.split(";")[0]) || !(await looksLikeAudio(audio))) return json({ error: "Unsupported audio type" }, 415);
    const stored = await db.speakingSubmission.count({ where: { userId: user.id, audioPath: { not: null } } });
    if (stored >= MAX_STORED_RECORDINGS) return json({ error: "Recording storage is full — submit without keeping the audio, or delete old recordings." }, 507);
  }

  const sub = await db.speakingSubmission.create({
    data: {
      userId: user.id,
      attemptId: attempt?.id ?? null,
      taskId: task.id,
      part: task.part,
      transcript: parsed.data.transcript,
      durationSec: parsed.data.durationSec,
    },
  });

  if (keep) {
    const ext = audio.type.includes("ogg") ? "ogg" : audio.type.includes("mp4") ? "m4a" : audio.type.includes("mpeg") ? "mp3" : audio.type.includes("wav") ? "wav" : "webm";
    const rel = audioPath(user.id, sub.id, ext);
    try {
      await saveFile(rel, Buffer.from(await audio.arrayBuffer()));
      await db.speakingSubmission.update({ where: { id: sub.id }, data: { audioPath: rel } });
    } catch {
      // The transcript is what gets assessed; losing the file must not lose the answer.
      return json({ id: sub.id, attemptId: attempt?.id ?? null, warning: "The recording could not be stored." });
    }
  }

  await logStudy(user.id, "speaking", Math.max(2, parsed.data.durationSec / 60 + 2));
  return json({ id: sub.id, attemptId: attempt?.id ?? null });
}
