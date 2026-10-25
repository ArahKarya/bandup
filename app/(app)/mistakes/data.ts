import "server-only";

import { db } from "@/lib/server/db";
import { getContent } from "@/lib/server/content";
import { humanCategory } from "@/lib/plan/study-plan";
import { mostMissedCategory, parseQuestionRef, questionInfo } from "@/lib/mistakes/notebook";
import { QUESTION_CATEGORIES, type QuestionCategory, type QuestionSet } from "@/lib/content/schema";
import type { Skill } from "@/generated/prisma/client";

export const DRILLABLE_SKILLS = ["reading", "listening", "grammar"] as const;
type DrillableSkill = (typeof DRILLABLE_SKILLS)[number];

export interface NotebookFilter {
  skill?: DrillableSkill;
  type?: QuestionCategory;
  showMastered: boolean;
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Reads filters from the query string; anything unknown is ignored. */
export function parseFilter(params: Record<string, string | string[] | undefined>): NotebookFilter {
  const skill = first(params.skill);
  const type = first(params.type);
  return {
    skill: DRILLABLE_SKILLS.find((s) => s === skill),
    type: QUESTION_CATEGORIES.find((c) => c === type),
    showMastered: first(params.mastered) === "1",
  };
}

export interface NotebookItem {
  id: string;
  setId: string;
  n: number;
  skill: Skill;
  category: string;
  categoryLabel: string;
  given: string;
  expected: string;
  timesWrong: number;
  correctStreak: number;
  mastered: boolean;
  text: string | null;
  explanation: string | null;
  evidence: string | null;
}

export interface NotebookSet {
  setId: string;
  title: string | null;
  skill: Skill;
}

const WEEK_MS = 7 * 86_400_000;
const LIST_LIMIT = 300;

async function setsById(ids: string[]): Promise<Map<string, QuestionSet>> {
  const sets = await Promise.all([...new Set(ids)].map((id) => getContent("question_set", id)));
  return new Map(sets.filter((s): s is QuestionSet => s !== null).map((s) => [s.id, s]));
}

export async function loadStats(userId: string) {
  const [open, masteredThisWeek, byCategory, categories] = await Promise.all([
    db.mistakeItem.count({ where: { userId, mastered: false } }),
    db.mistakeItem.count({ where: { userId, mastered: true, masteredAt: { gte: new Date(Date.now() - WEEK_MS) } } }),
    db.mistakeItem.groupBy({ by: ["category"], where: { userId, mastered: false }, _sum: { timesWrong: true } }),
    db.mistakeItem.findMany({ where: { userId }, distinct: ["category"], select: { category: true } }),
  ]);
  const top = mostMissedCategory(byCategory.map((r) => ({ category: r.category, timesWrong: r._sum.timesWrong ?? 0 })));
  return {
    open,
    masteredThisWeek,
    mostMissed: top ? { label: humanCategory(top.category), count: top.count } : null,
    categories: categories.map((c) => c.category).sort(),
    hasAny: categories.length > 0,
  };
}

export async function loadItems(userId: string, filter: NotebookFilter): Promise<{ items: NotebookItem[]; sets: NotebookSet[] }> {
  const rows = await db.mistakeItem.findMany({
    where: {
      userId,
      ...(filter.skill ? { skill: filter.skill } : {}),
      ...(filter.type ? { category: filter.type } : {}),
      ...(filter.showMastered ? {} : { mastered: false }),
    },
    orderBy: [{ updatedAt: "desc" }, { n: "asc" }],
    take: LIST_LIMIT,
  });
  const sets = await setsById(rows.map((r) => r.setId));
  const items = rows.map((r): NotebookItem => {
    const set = sets.get(r.setId);
    const info = set ? questionInfo(set, r.n) : null;
    return {
      id: r.id,
      setId: r.setId,
      n: r.n,
      skill: r.skill,
      category: r.category,
      categoryLabel: humanCategory(r.category),
      given: r.given,
      expected: r.expected,
      timesWrong: r.timesWrong,
      correctStreak: r.correctStreak,
      mastered: r.mastered,
      text: info?.text ?? null,
      explanation: info?.explanation ?? null,
      evidence: info?.evidence ?? null,
    };
  });
  const setList = [...new Set(rows.map((r) => r.setId))].map((setId): NotebookSet => {
    const set = sets.get(setId);
    return { setId, title: set?.title ?? null, skill: set?.skill ?? rows.find((r) => r.setId === setId)!.skill };
  });
  return { items, sets: setList };
}

export interface BookmarkedQuestion {
  id: string;
  setId: string;
  n: number;
  setTitle: string;
  skill: Skill;
  text: string;
}

export interface BookmarkedLesson {
  id: string;
  lessonId: string;
  title: string;
  /** Lesson skills include "general" and "vocabulary", which have no skill colour. */
  skill: string;
}

export async function loadBookmarks(userId: string): Promise<{ questions: BookmarkedQuestion[]; lessons: BookmarkedLesson[] }> {
  const rows = await db.bookmark.findMany({ where: { userId, kind: { in: ["question", "lesson"] } }, orderBy: { createdAt: "desc" }, take: 300 });
  const refs = rows.flatMap((r) => {
    const ref = r.kind === "question" ? parseQuestionRef(r.refId) : null;
    return ref ? [{ id: r.id, ...ref }] : [];
  });
  const sets = await setsById(refs.map((r) => r.setId));
  const questions = refs.flatMap((r): BookmarkedQuestion[] => {
    const set = sets.get(r.setId);
    const info = set ? questionInfo(set, r.n) : null;
    return set && info ? [{ id: r.id, setId: r.setId, n: r.n, setTitle: set.title, skill: set.skill, text: info.text }] : [];
  });
  const lessonRows = rows.filter((r) => r.kind === "lesson");
  const lessonContent = await Promise.all(lessonRows.map((r) => getContent("lesson", r.refId)));
  const lessons = lessonRows.flatMap((r, i): BookmarkedLesson[] => {
    const lesson = lessonContent[i];
    return lesson ? [{ id: r.id, lessonId: lesson.id, title: lesson.title, skill: lesson.skill }] : [];
  });
  return { questions, lessons };
}
