import "server-only";

import { db } from "./db";
import { getContent } from "./content";
import type { Attempt, Prisma, Skill } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;
import { gradeSet, type AnswerMap } from "@/lib/scoring/grade";
import { listeningBand, readingBand, roundOverall, scaledBand } from "@/lib/scoring/band";
import { countWords } from "@/lib/content/check";
import { calendarToday } from "@/lib/stats/dates";
import {
  PLACEMENT_ID,
  PLACEMENT_SECTIONS,
  deadlineFrom,
  isExpired,
  mockSections,
  parseState,
  practiceSections,
  type AttemptResult,
  type AttemptState,
  type Section,
  type SectionResult,
} from "@/lib/attempt/sections";

/** The ordered sections of an attempt, rebuilt from its content. */
export async function sectionsOf(attempt: Pick<Attempt, "mode" | "contentId">): Promise<Section[]> {
  if (attempt.mode === "placement") return PLACEMENT_SECTIONS;
  if (attempt.mode === "mock") {
    const mock = await getContent("mock_test", attempt.contentId);
    if (!mock) throw new Error(`Mock test ${attempt.contentId} is not available`);
    return mockSections(mock);
  }
  const set = await getContent("question_set", attempt.contentId);
  if (!set) throw new Error(`Question set ${attempt.contentId} is not available`);
  return practiceSections(set);
}

export async function findOwnAttempt(userId: string, attemptId: string): Promise<Attempt | null> {
  return db.attempt.findFirst({ where: { id: attemptId, userId } });
}

/** Resumes the open attempt for this content, or starts one. */
export async function openAttempt(
  userId: string,
  mode: "practice" | "mock" | "placement",
  contentId: string,
): Promise<Attempt> {
  const existing = await db.attempt.findFirst({
    where: { userId, mode, contentId, status: "in_progress" },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return existing;

  const contentKind = mode === "mock" ? "mock_test" : "question_set";
  const sections = await sectionsOf({ mode, contentId });
  const first = sections[0];
  const now = new Date();
  // Practice timers are advisory; only mock and placement sections close on their own.
  const strict = mode !== "practice";
  const state: AttemptState = {
    section: 0,
    deadline: strict && first.kind !== "speaking" ? deadlineFrom(now, first.minutes) : null,
    sectionStartedAt: now.toISOString(),
    answers: {},
    essays: {},
  };
  return db.attempt.create({
    data: { userId, mode, contentId, contentKind, state: state as unknown as Prisma.InputJsonValue },
  });
}

const MAX_ESSAY_CHARS = 20_000;
const MAX_ANSWER_CHARS = 200;

/** Keeps only plausible answers: question-number keys, short strings or short string arrays. */
export function sanitizeAnswers(raw: unknown): AnswerMap {
  if (!raw || typeof raw !== "object") return {};
  const out: AnswerMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{1,3}$/.test(k)) continue;
    if (typeof v === "string") out[k] = v.slice(0, MAX_ANSWER_CHARS);
    else if (Array.isArray(v)) out[k] = v.filter((x): x is string => typeof x === "string").slice(0, 5).map((x) => x.slice(0, 8));
  }
  return out;
}

/**
 * Merges client answers for the current section into the stored state, key by key, so two
 * tabs on the same section cannot wipe each other's answers.
 */
export function mergeSectionInput(
  state: AttemptState,
  section: Section,
  input: { answers?: Record<string, unknown>; essays?: Record<string, unknown> },
): AttemptState {
  if (section.kind === "sets") {
    const answers = { ...state.answers };
    for (const id of section.setIds) {
      if (input.answers && id in input.answers) answers[id] = { ...answers[id], ...sanitizeAnswers(input.answers[id]) };
    }
    return { ...state, answers };
  }
  if (section.kind === "writing") {
    const essays = { ...state.essays };
    for (const id of section.taskIds) {
      const v = input.essays?.[id];
      if (typeof v === "string") essays[id] = v.slice(0, MAX_ESSAY_CHARS);
    }
    return { ...state, essays };
  }
  return state;
}

async function gradeSection(section: Section, state: AttemptState, examModule: "academic" | "general"): Promise<SectionResult> {
  if (section.kind !== "sets") return { skill: section.kind, raw: 0, max: 0, band: null, sets: [] };

  const sets = [];
  for (const id of section.setIds) {
    const set = await getContent("question_set", id);
    if (!set) continue;
    const graded = gradeSet(set, state.answers[id] ?? {});
    sets.push({ setId: id, title: set.title, ...graded });
  }
  const raw = sets.reduce((n, s) => n + s.raw, 0);
  const max = sets.reduce((n, s) => n + s.max, 0);

  let band: number | null = null;
  if (section.skill === "grammar") band = scaledBand(raw, max, "reading", "academic");
  else if (max === 40) band = section.skill === "listening" ? listeningBand(raw) : readingBand(raw, examModule);
  else band = scaledBand(raw, max, section.skill, examModule);

  return { skill: section.skill, raw, max, band, sets };
}

async function recordSectionOutcome(tx: Tx, attempt: Attempt, result: SectionResult): Promise<void> {
  if (result.sets.length === 0) return;
  const skill = result.skill as Skill;
  const userId = attempt.userId;
  await tx.questionResult.createMany({
    data: result.sets.flatMap((s) =>
      s.items.map((i) => ({ attemptId: attempt.id, userId, skill, category: i.category, correct: i.correct })),
    ),
  });
  if (result.band !== null && skill !== "grammar") {
    await tx.skillScore.create({ data: { userId, skill, band: result.band, source: attempt.mode, attemptId: attempt.id } });
  }
}

/** Adds study minutes to today's log for one activity. */
export async function logStudy(userId: string, activity: string, minutes: number, client: Tx = db): Promise<void> {
  const m = Math.max(1, Math.min(240, Math.round(minutes)));
  const day = calendarToday();
  await client.studyLog.upsert({
    where: { userId_day_activity: { userId, day, activity } },
    create: { userId, day, activity, minutes: m },
    update: { minutes: { increment: m } },
  });
}

async function createEssays(tx: Tx, attempt: Attempt, section: Section, state: AttemptState): Promise<void> {
  if (section.kind !== "writing") return;
  for (const [i, taskId] of section.taskIds.entries()) {
    const text = (state.essays[taskId] ?? "").trim();
    await tx.writingSubmission.create({
      data: { userId: attempt.userId, attemptId: attempt.id, taskId, task: i + 1, text, wordCount: countWords(text), durationSec: 0 },
    });
  }
}

/**
 * Runs `fn` with the attempt row locked (SELECT … FOR UPDATE) and freshly read, so autosave,
 * "next section", timer expiry and a second tab are applied one at a time, never interleaved.
 */
async function withLockedAttempt<T>(attemptId: string, fn: (tx: Tx, attempt: Attempt) => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM attempts WHERE id = ${attemptId} FOR UPDATE`;
      const fresh = await tx.attempt.findUniqueOrThrow({ where: { id: attemptId } });
      return fn(tx, fresh);
    },
    { timeout: 30_000 },
  );
}

/** Study minutes for a closed section: time since it opened, capped so an idle tab cannot inflate it. */
function sectionMinutesSpent(state: AttemptState, section: Section, now: Date): number {
  const limit = "minutes" in section ? section.minutes * 1.5 : 20;
  const opened = state.sectionStartedAt ? new Date(state.sectionStartedAt).getTime() : now.getTime();
  return Math.min((now.getTime() - opened) / 60_000, limit);
}

type SectionInput = { answers?: Record<string, unknown>; essays?: Record<string, unknown> };

async function advanceLocked(tx: Tx, attempt: Attempt, input: SectionInput): Promise<Attempt> {
  const sections = await sectionsOf(attempt);
  const current = parseState(attempt.state);
  const section = sections[current.section];
  if (!section) return attempt;
  const state = mergeSectionInput(current, section, input);
  const profile = await tx.profile.findUnique({ where: { userId: attempt.userId } });

  const graded = await gradeSection(section, state, profile?.module ?? "academic");
  await recordSectionOutcome(tx, attempt, graded);
  await createEssays(tx, attempt, section, state);

  const previous = (attempt.result as unknown as AttemptResult | null)?.sections ?? [];
  const result: AttemptResult = { sections: [...previous, graded] };

  const now = new Date();
  const nextIndex = state.section + 1;
  const done = nextIndex >= sections.length;
  const next = sections[nextIndex];
  const strict = attempt.mode !== "practice";
  const nextState: AttemptState = {
    ...state,
    section: nextIndex,
    deadline: !done && strict && next.kind !== "speaking" ? deadlineFrom(now, next.minutes) : null,
    sectionStartedAt: now.toISOString(),
  };

  if (section.kind !== "speaking") await logStudy(attempt.userId, graded.skill, sectionMinutesSpent(current, section, now), tx);

  const lr = result.sections.filter((s) => s.sets.length > 0);
  const bands: Record<string, number | null> = Object.fromEntries(lr.map((s) => [s.skill, s.band]));
  const placementBand = done && attempt.mode === "placement" ? placementEstimate(result) : null;
  if (placementBand !== null) {
    bands.overall = placementBand;
    await tx.profile.update({ where: { userId: attempt.userId }, data: { startingBand: placementBand } });
  }

  return tx.attempt.update({
    where: { id: attempt.id },
    data: {
      state: nextState as unknown as Prisma.InputJsonValue,
      result: result as unknown as Prisma.InputJsonValue,
      bands: { ...((attempt.bands as Record<string, unknown> | null) ?? {}), ...bands } as Prisma.InputJsonValue,
      rawScore: lr.reduce((n, s) => n + s.raw, 0),
      maxScore: lr.reduce((n, s) => n + s.max, 0),
      elapsedSec: Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000),
      ...(done ? { status: "submitted", submittedAt: now } : {}),
    },
  });
}

function placementEstimate(result: AttemptResult): number | null {
  const bands = result.sections.map((s) => s.band).filter((b): b is number => b !== null);
  if (bands.length === 0) return null;
  return roundOverall(bands.reduce((a, b) => a + b, 0) / bands.length);
}

/**
 * Closes section `expectedSection`: grades it, records results and moves on; the last
 * section submits the attempt. A call for a section that is no longer current (double
 * click, second tab, timer and button racing) does nothing. Input arriving after the
 * deadline is ignored — the last saved state is graded instead.
 */
export async function advanceAttempt(attemptId: string, expectedSection: number, input: SectionInput): Promise<Attempt> {
  return withLockedAttempt(attemptId, async (tx, attempt) => {
    const state = parseState(attempt.state);
    if (attempt.status !== "in_progress" || state.section !== expectedSection) return attempt;
    return advanceLocked(tx, attempt, isExpired(state, new Date()) ? {} : input);
  });
}

/** Closes a strict section whose time ran out while nobody was saving (e.g. the tab was closed). */
export async function closeIfExpired(attempt: Attempt): Promise<Attempt> {
  if (attempt.status !== "in_progress" || attempt.mode === "practice") return attempt;
  const state = parseState(attempt.state);
  if (!isExpired(state, new Date())) return attempt;
  return advanceAttempt(attempt.id, state.section, {});
}

/**
 * Autosave. `stale` tells the client its view is out of date (the section closed, or the
 * attempt ended) so it reloads instead of claiming "Saved" for answers that were dropped.
 */
export async function saveAttempt(
  attemptId: string,
  input: { section: number } & SectionInput,
): Promise<{ attempt: Attempt; stale: boolean }> {
  return withLockedAttempt(attemptId, async (tx, attempt) => {
    const state = parseState(attempt.state);
    if (attempt.status !== "in_progress" || input.section !== state.section) return { attempt, stale: true };
    if (isExpired(state, new Date())) return { attempt: await advanceLocked(tx, attempt, {}), stale: true };

    const sections = await sectionsOf(attempt);
    const section = sections[state.section];
    if (!section) return { attempt, stale: true };
    const next = mergeSectionInput(state, section, input);
    const updated = await tx.attempt.update({ where: { id: attempt.id }, data: { state: next as unknown as Prisma.InputJsonValue } });
    return { attempt: updated, stale: false };
  });
}

/** The kind of section the attempt is currently on, or null once it has ended. */
export async function currentSectionKind(attempt: Attempt): Promise<Section["kind"] | null> {
  if (attempt.status !== "in_progress") return null;
  const sections = await sectionsOf(attempt);
  return sections[parseState(attempt.state).section]?.kind ?? null;
}

export { PLACEMENT_ID };
