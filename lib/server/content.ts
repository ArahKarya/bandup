import "server-only";

import { cache } from "react";
import { db } from "./db";
import type { ContentKind } from "@/generated/prisma/client";
import type {
  Lesson,
  MockTest,
  QuestionSet,
  SpeakingTask,
  VocabDeck,
  WritingTask,
} from "@/lib/content/schema";
import { setNumbers } from "@/lib/content/check";

/**
 * Read access to synced content. Payloads were validated by `content:sync`, so they are
 * trusted to match their schema here.
 */

interface KindMap {
  lesson: Lesson;
  vocab_deck: VocabDeck;
  question_set: QuestionSet;
  writing_task: WritingTask;
  speaking_task: SpeakingTask;
  mock_test: MockTest;
}

export interface ContentSummary {
  id: string;
  kind: ContentKind;
  skill: string | null;
  module: string | null;
  title: string;
  category: string | null;
  difficulty: number;
  sortOrder: number;
}

export const getContent = cache(async <K extends ContentKind>(kind: K, id: string): Promise<KindMap[K] | null> => {
  const row = await db.contentItem.findFirst({ where: { id, kind, published: true }, select: { payload: true } });
  return row ? (row.payload as unknown as KindMap[K]) : null;
});

export async function listContent<K extends ContentKind>(
  kind: K,
  where: { skill?: string; module?: string[]; includeUnlisted?: boolean } = {},
): Promise<(ContentSummary & { payload: KindMap[K] })[]> {
  const rows = await db.contentItem.findMany({
    where: {
      kind,
      published: true,
      ...(where.includeUnlisted ? {} : { unlisted: false }),
      ...(where.skill ? { skill: where.skill } : {}),
      ...(where.module ? { module: { in: where.module } } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { difficulty: "asc" }, { title: "asc" }],
  });
  return rows.map((r) => ({ ...r, payload: r.payload as unknown as KindMap[K] }));
}

/** Modules a learner should see: their own plus material shared by both. */
export const modulesFor = (module: "academic" | "general"): string[] => [module, "both"];

export function questionCount(set: QuestionSet): number {
  return setNumbers(set).length;
}

/** Every category used in a set, for filters and labels. */
export function setCategories(set: QuestionSet): string[] {
  return [...new Set(set.groups.map((g) => g.category))];
}
