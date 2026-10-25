import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type ContentKind, type Prisma } from "../generated/prisma/client";
import { loadContent } from "../lib/content/load";

/**
 * `pnpm content:sync` — validates content/ and upserts it into content_items.
 *
 * Unchanged items (same hash) are skipped. The `published` flag belongs to admins, so a
 * sync never overwrites it; items whose file was deleted are unpublished rather than
 * removed, so old attempts can still be reviewed.
 */

interface Row {
  id: string;
  kind: ContentKind;
  skill: string | null;
  module: string | null;
  title: string;
  category: string | null;
  difficulty: number;
  sortOrder: number;
  unlisted: boolean;
  payload: Prisma.InputJsonValue;
}

try {
  process.loadEnvFile(".env");
} catch {
  // no .env file — use the real environment
}

async function main(): Promise<void> {
  const { bundle, errors } = await loadContent();
  if (errors.length > 0) {
    process.stderr.write(`Content is invalid — run pnpm content:validate for details (${errors.length} problems).\n`);
    process.exit(1);
  }

  const rows: Row[] = [
    ...bundle.lessons.map((l) => ({
      id: l.id, kind: "lesson" as const, skill: l.skill, module: null, title: l.title,
      category: l.categories[0] ?? null, difficulty: ["beginner", "intermediate", "advanced"].indexOf(l.level) + 1,
      sortOrder: l.order, unlisted: false, payload: l,
    })),
    ...bundle.decks.map((d, i) => ({
      id: d.id, kind: "vocab_deck" as const, skill: null, module: null, title: d.title,
      category: d.theme, difficulty: 1, sortOrder: i, unlisted: false, payload: d,
    })),
    ...bundle.sets.map((s) => ({
      id: s.id, kind: "question_set" as const, skill: s.skill, module: s.module, title: s.title,
      category: s.groups[0].category, difficulty: s.difficulty, sortOrder: s.part ?? 0, unlisted: s.unlisted, payload: s,
    })),
    ...bundle.writing.map((w) => ({
      id: w.id, kind: "writing_task" as const, skill: "writing", module: w.module, title: w.title,
      category: w.taskType, difficulty: w.difficulty, sortOrder: w.task, unlisted: w.unlisted, payload: w,
    })),
    ...bundle.speaking.map((s) => ({
      id: s.id, kind: "speaking_task" as const, skill: "speaking", module: "both", title: s.topic,
      category: `part_${s.part}`, difficulty: s.difficulty, sortOrder: s.part, unlisted: s.unlisted, payload: s,
    })),
    ...bundle.mocks.map((m, i) => ({
      id: m.id, kind: "mock_test" as const, skill: null, module: m.module, title: m.title,
      category: null, difficulty: 2, sortOrder: i, unlisted: false, payload: m,
    })),
  ];

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    const existing = new Map((await db.contentItem.findMany({ select: { id: true, hash: true } })).map((r) => [r.id, r.hash]));
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const hash = createHash("sha256").update(JSON.stringify(row)).digest("hex");
      const prev = existing.get(row.id);
      if (prev === hash) continue;
      const data = { ...row, hash };
      if (prev === undefined) {
        await db.contentItem.create({ data });
        created++;
      } else {
        await db.contentItem.update({ where: { id: row.id }, data });
        updated++;
      }
    }

    const keep = new Set(rows.map((r) => r.id));
    const removed = [...existing.keys()].filter((id) => !keep.has(id));
    if (removed.length) await db.contentItem.updateMany({ where: { id: { in: removed } }, data: { published: false } });

    process.stdout.write(
      `Synced ${rows.length} items: ${created} created, ${updated} updated, ${rows.length - created - updated} unchanged, ${removed.length} unpublished (file removed).\n`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
