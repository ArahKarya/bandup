import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// React's per-request cache is not available outside a render; a pass-through is equivalent here.
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const { db } = await import("@/lib/server/db");
const { advanceAttempt, openAttempt, saveAttempt } = await import("@/lib/server/attempts");
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
