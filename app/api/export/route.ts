import { currentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

/** Everything BandUp stores about the learner, as JSON. API key ciphertext is left out. */
export async function GET() {
  const user = await currentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [profile, attempts, writing, speaking, skillScores, studyLogs, vocab, lessons] = await Promise.all([
    db.profile.findUnique({ where: { userId: user.id } }),
    db.attempt.findMany({ where: { userId: user.id } }),
    db.writingSubmission.findMany({ where: { userId: user.id }, include: { scores: true } }),
    db.speakingSubmission.findMany({ where: { userId: user.id }, include: { scores: true } }),
    db.skillScore.findMany({ where: { userId: user.id } }),
    db.studyLog.findMany({ where: { userId: user.id } }),
    db.vocabReview.findMany({ where: { userId: user.id } }),
    db.lessonProgress.findMany({ where: { userId: user.id } }),
  ]);

  const body = JSON.stringify({ exportedAt: new Date(), user: { name: user.name, email: user.email }, profile, attempts, writing, speaking, skillScores, studyLogs, vocab, lessons }, null, 2);
  return new Response(body, {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="bandup-export.json"` },
  });
}
