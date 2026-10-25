import "server-only";

import { db } from "./db";
import { overallBand, writingBand } from "@/lib/scoring/band";

export interface MockBands {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
}

/**
 * Bands for a mock attempt. Listening and Reading are fixed at submission; Writing and
 * Speaking come from the latest assessment of each linked submission, so the overall band
 * appears once both have been assessed.
 */
export async function mockBands(attemptId: string, stored: unknown): Promise<MockBands> {
  const lr = (stored ?? {}) as Record<string, number | null>;

  const essays = await db.writingSubmission.findMany({
    where: { attemptId },
    include: { scores: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { task: "asc" },
  });
  const t1 = essays.find((e) => e.task === 1)?.scores[0]?.band;
  const t2 = essays.find((e) => e.task === 2)?.scores[0]?.band;
  const writing = t1 !== undefined && t2 !== undefined ? writingBand(t1, t2) : null;

  const talks = await db.speakingSubmission.findMany({
    where: { attemptId },
    include: { scores: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const scored = talks.map((s) => s.scores[0]?.band).filter((b): b is number => b !== undefined);
  // The real test scores the whole interview; here each part is assessed and averaged.
  const speaking = scored.length > 0 ? Math.floor((scored.reduce((a, b) => a + b, 0) / scored.length) * 2) / 2 : null;

  const parts = [lr.listening ?? null, lr.reading ?? null, writing, speaking];
  const overall = parts.every((p) => p !== null) ? overallBand(parts as number[]) : null;
  return { listening: lr.listening ?? null, reading: lr.reading ?? null, writing, speaking, overall };
}
