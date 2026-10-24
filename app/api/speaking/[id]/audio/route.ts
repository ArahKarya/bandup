import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { readStored } from "@/lib/server/storage";

const TYPES: Record<string, string> = { webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", mp3: "audio/mpeg", wav: "audio/wav" };

/** Streams a recording back to its owner only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/speaking/[id]/audio">) {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const sub = await db.speakingSubmission.findFirst({ where: { id, userId: user.id }, select: { audioPath: true } });
  if (!sub?.audioPath) return new Response("Not found", { status: 404 });

  try {
    const body = await readStored(sub.audioPath);
    const ext = sub.audioPath.split(".").pop() ?? "webm";
    return new Response(new Uint8Array(body), { headers: { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
