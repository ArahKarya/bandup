import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// React's per-request cache is not available outside a render; a pass-through is equivalent here.
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const { db } = await import("@/lib/server/db");
const { advanceAttempt, openAttempt, openDrillAttempt, saveAttempt } = await import("@/lib/server/attempts");
const { parseState } = await import("@/lib/attempt/sections");

/**
 * Runs against the real database (DATABASE_URL), because the guarantees under test — row
 * locking and idempotent section advances — only exist there. Requires `pnpm content:sync`.
 */
describe("attempt engine concurrency", () => {
  let userId = "";

  beforeAll(async () => {
    const user = await db.user.create({
      data: { email: `it-${Date.now()}@example.com`, name: "IT", passwordHash: "x", profile: { create: { onboardedAt: new Date() } } },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  });

  it("grades a section exactly once when several advances race", async () => {
    const attempt = await openAttempt(userId, "placement", "placement");
    const results = await Promise.all([0, 1, 2, 3].map(() => advanceAttempt(attempt.id, 0, { answers: {} })));

    const fresh = await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(parseState(fresh.state).section).toBe(1);
    expect(results.every((r) => r.id === attempt.id)).toBe(true);
    // place-grammar has 15 questions: one set of results, not four.
    expect(await db.questionResult.count({ where: { attemptId: attempt.id } })).toBe(15);
  });

  it("does not let a stale autosave roll a closed section back", async () => {
    const attempt = await openAttempt(userId, "mock", "mock-academic-1");
    await saveAttempt(attempt.id, { section: 0, answers: { "m1-l1": { "1": "early" } } });
    await advanceAttempt(attempt.id, 0, {});
    const stale = await saveAttempt(attempt.id, { section: 0, answers: { "m1-l1": { "1": "late" } } });

    expect(stale.stale).toBe(true);
    const fresh = await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
    const state = parseState(fresh.state);
    expect(state.section).toBe(1);
    expect(state.answers["m1-l1"]?.["1"]).toBe("early");
  });

  it("merges autosaves key by key so two tabs keep each other's answers", async () => {
    const attempt = await openAttempt(userId, "practice", "prd-living-light");
    await saveAttempt(attempt.id, { section: 0, answers: { "prd-living-light": { "1": "from tab A" } } });
    await saveAttempt(attempt.id, { section: 0, answers: { "prd-living-light": { "2": "from tab B" } } });
    const state = parseState((await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).state);
    expect(state.answers["prd-living-light"]).toEqual({ "1": "from tab A", "2": "from tab B" });
  });
});

describe("mistake notebook", () => {
  let userId = "";

  beforeAll(async () => {
    userId = (await db.user.create({ data: { email: `it-m-${Date.now()}@example.com`, name: "IT", passwordHash: "x", profile: { create: { onboardedAt: new Date() } } } })).id;
  });
  afterAll(async () => {
    await db.user.delete({ where: { id: userId } });
  });

  it("records answered wrong questions, skips blanks, and masters after two correct drills", async () => {
    const attempt = await openAttempt(userId, "practice", "prd-living-light");
    const set = (await db.contentItem.findUniqueOrThrow({ where: { id: "prd-living-light" } })).payload as { groups: { type: string; questions: { n: number }[] }[] };
    const tfng = set.groups.find((g) => g.type === "tfng")!;
    const n = tfng.questions[0].n;
    // A deliberately impossible answer for one TFNG question; everything else blank.
    await advanceAttempt(attempt.id, 0, { answers: { "prd-living-light": { [n]: "MAYBE" } } });

    const items = await db.mistakeItem.findMany({ where: { userId } });
    expect(items.map((i) => i.n)).toEqual([n]);
    expect(await db.attempt.count({ where: { id: attempt.id } })).toBe(1);

    const key = (await db.contentItem.findUniqueOrThrow({ where: { id: "prd-living-light" } })).payload as { groups: { type: string; questions: { n: number; answer?: string }[] }[] };
    const right = key.groups.find((g) => g.type === "tfng")!.questions[0].answer!;
    for (let i = 0; i < 2; i++) {
      const drill = await openDrillAttempt(userId, [{ setId: "prd-living-light", n }]);
      await advanceAttempt(drill!.id, 0, { answers: { "prd-living-light": { [n]: right } } });
    }
    const item = await db.mistakeItem.findFirstOrThrow({ where: { userId, n } });
    expect(item.mastered).toBe(true);
    expect(item.correctStreak).toBe(2);
    // Drills never touch the band timeline or accuracy stats.
    const drillIds = (await db.attempt.findMany({ where: { userId, mode: "drill" }, select: { id: true } })).map((a) => a.id);
    expect(await db.questionResult.count({ where: { attemptId: { in: drillIds } } })).toBe(0);
    expect(await db.skillScore.count({ where: { attemptId: { in: drillIds } } })).toBe(0);
  });

  it("keeps annotations and flags through autosave", async () => {
    const attempt = await openAttempt(userId, "practice", "prd-cooling-cities");
    await saveAttempt(attempt.id, {
      section: 0,
      annotations: { "prd-cooling-cities": [{ id: "h1", block: 0, start: 0, end: 10, kind: "hl" }] },
      flags: { "prd-cooling-cities": [3, 3, 5] },
    });
    const state = parseState((await db.attempt.findUniqueOrThrow({ where: { id: attempt.id } })).state);
    expect(state.annotations["prd-cooling-cities"]).toHaveLength(1);
    expect(state.flags["prd-cooling-cities"]).toEqual([3, 5]);
  });
});
