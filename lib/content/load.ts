import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import {
  lessonMeta,
  mockTest,
  questionSet,
  speakingTask,
  vocabDeck,
  writingTask,
  type Lesson,
  type MockTest,
  type QuestionSet,
  type SpeakingTask,
  type VocabDeck,
  type WritingTask,
} from "./schema";
import { checkMock, checkSet } from "./check";

/**
 * Reads and validates everything under `content/`. Used by the sync and validate scripts;
 * the running app reads content from the database, never from disk.
 */

export interface ContentBundle {
  lessons: Lesson[];
  decks: VocabDeck[];
  sets: QuestionSet[];
  writing: WritingTask[];
  speaking: SpeakingTask[];
  mocks: MockTest[];
}

export interface LoadResult {
  bundle: ContentBundle;
  errors: string[];
}

async function walk(dir: string, ext: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const nested = await Promise.all(
    entries.map((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return walk(full, ext);
      return Promise.resolve(e.name.endsWith(ext) ? [full] : []);
    }),
  );
  return nested.flat().sort();
}

function formatZod(file: string, error: { issues: { path: PropertyKey[]; message: string }[] }): string[] {
  return error.issues.map((i) => `${file}: ${i.path.join(".") || "(root)"} — ${i.message}`);
}

export async function loadContent(root = path.join(process.cwd(), "content")): Promise<LoadResult> {
  const errors: string[] = [];
  const rel = (f: string) => path.relative(root, f);

  const parseJsonFiles = async <T>(
    dirs: string[],
    schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } } },
  ): Promise<T[]> => {
    const files = (await Promise.all(dirs.map((d) => walk(path.join(root, d), ".json")))).flat();
    const out: T[] = [];
    for (const file of files) {
      let raw: unknown;
      try {
        raw = JSON.parse(await readFile(file, "utf8"));
      } catch (e) {
        errors.push(`${rel(file)}: invalid JSON — ${(e as Error).message}`);
        continue;
      }
      const parsed = schema.safeParse(raw);
      if (parsed.success) out.push(parsed.data);
      else errors.push(...formatZod(rel(file), parsed.error));
    }
    return out;
  };

  const sets = await parseJsonFiles(["practice", "mock-tests/sets", "placement"], questionSet);
  const writing = await parseJsonFiles(["writing"], writingTask);
  const speaking = await parseJsonFiles(["speaking"], speakingTask);
  const decks = await parseJsonFiles(["vocab"], vocabDeck);
  const mocks = await parseJsonFiles(["mock-tests/tests"], mockTest);

  const lessons: Lesson[] = [];
  for (const file of await walk(path.join(root, "lessons"), ".md")) {
    const { data, content } = matter(await readFile(file, "utf8"));
    const parsed = lessonMeta.safeParse(data);
    if (!parsed.success) {
      errors.push(...formatZod(rel(file), parsed.error));
      continue;
    }
    parsed.data.quiz.forEach((q, i) => {
      if (q.answer >= q.options.length) errors.push(`${rel(file)}: quiz ${i + 1} answer index out of range`);
    });
    lessons.push({ ...parsed.data, body: content.trim() });
  }

  // Ids must be unique across every kind, because attempts reference content by id alone.
  const seen = new Map<string, string>();
  const all: { id: string; kind: string }[] = [
    ...lessons.map((l) => ({ id: l.id, kind: "lesson" })),
    ...decks.map((d) => ({ id: d.id, kind: "deck" })),
    ...sets,
    ...writing,
    ...speaking,
    ...mocks,
  ];
  for (const item of all) {
    const prev = seen.get(item.id);
    if (prev) errors.push(`duplicate id "${item.id}" (${prev} and ${item.kind})`);
    seen.set(item.id, item.kind);
  }

  const wordIds = new Set<string>();
  for (const deck of decks) {
    for (const w of deck.words) {
      if (wordIds.has(w.id)) errors.push(`vocab: duplicate word id "${w.id}" in ${deck.id}`);
      wordIds.add(w.id);
    }
  }

  for (const set of sets) errors.push(...checkSet(set).map((m) => `${set.id}: ${m}`));

  const lookup = {
    sets: new Map(sets.map((s) => [s.id, s])),
    writing: new Map(writing.map((w) => [w.id, { task: w.task, module: w.module }])),
    speaking: new Map(speaking.map((s) => [s.id, { part: s.part }])),
  };
  for (const mock of mocks) errors.push(...checkMock(mock, lookup).map((m) => `${mock.id}: ${m}`));

  return { bundle: { lessons, decks, sets, writing, speaking, mocks }, errors };
}
