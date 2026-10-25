import type { MockTest, QuestionSet } from "@/lib/content/schema";
import type { AnswerMap, GradedItem } from "@/lib/scoring/grade";

/**
 * An attempt is a sequence of sections. A practice set is one section; the placement test
 * and a mock test are several, taken in order with their own timers.
 */

export type Section =
  | {
      kind: "sets";
      skill: "listening" | "reading" | "grammar";
      setIds: string[];
      minutes: number;
      /** Drill attempts: only these question numbers of each set are asked. */
      drill?: Record<string, number[]>;
    }
  | { kind: "writing"; taskIds: string[]; minutes: number }
  | { kind: "speaking"; taskIds: string[] };

export interface AttemptState {
  section: number;
  /** ISO timestamp the current section closes at; null for untimed or practice sections. */
  deadline: string | null;
  /** ISO timestamp the current section was opened, for study-time logging. */
  sectionStartedAt: string | null;
  answers: Record<string, AnswerMap>;
  essays: Record<string, string>;
  /** Highlights and notes in passages, per set. */
  annotations: Record<string, Annotation[]>;
  /** Questions flagged "review later", per set. */
  flags: Record<string, number[]>;
  /** Drill attempts: the questions being re-done, per set (fixed when the drill starts). */
  drill: Record<string, number[]>;
}

/**
 * A highlight or note on a passage paragraph (reading) or script line (listening), by
 * character offsets within that block's text.
 */
export interface Annotation {
  id: string;
  /** Paragraph or script-line index. */
  block: number;
  start: number;
  end: number;
  kind: "hl" | "note";
  note?: string;
}

export interface SetResult {
  setId: string;
  title: string;
  raw: number;
  max: number;
  items: GradedItem[];
}

export interface SectionResult {
  skill: string;
  raw: number;
  max: number;
  band: number | null;
  sets: SetResult[];
}

export interface AttemptResult {
  sections: SectionResult[];
}

export const PLACEMENT_ID = "placement";

export const PLACEMENT_SECTIONS: Section[] = [
  { kind: "sets", skill: "grammar", setIds: ["place-grammar"], minutes: 8 },
  { kind: "sets", skill: "reading", setIds: ["place-reading"], minutes: 12 },
  { kind: "sets", skill: "listening", setIds: ["place-listening"], minutes: 8 },
];

/** Listening allows 30 minutes plus transfer time; the paper test gives 10, computer 2. */
export const MOCK_MINUTES = { listening: 32, reading: 60, writing: 60 } as const;

export function mockSections(mock: MockTest): Section[] {
  return [
    { kind: "sets", skill: "listening", setIds: mock.listening, minutes: MOCK_MINUTES.listening },
    { kind: "sets", skill: "reading", setIds: mock.reading, minutes: MOCK_MINUTES.reading },
    { kind: "writing", taskIds: [...mock.writing], minutes: MOCK_MINUTES.writing },
    { kind: "speaking", taskIds: [...mock.speaking] },
  ];
}

export function practiceSections(set: QuestionSet): Section[] {
  return [{ kind: "sets", skill: set.skill, setIds: [set.id], minutes: set.minutes }];
}

/** A drill: one untimed section over the chosen questions of one or more sets. */
export function drillSections(drill: Record<string, number[]>, skill: "listening" | "reading" | "grammar"): Section[] {
  const count = Object.values(drill).reduce((n, nums) => n + nums.length, 0);
  return [{ kind: "sets", skill, setIds: Object.keys(drill), minutes: Math.max(5, Math.ceil(count * 1.5)), drill }];
}

export function emptyState(): AttemptState {
  return { section: 0, deadline: null, sectionStartedAt: null, answers: {}, essays: {}, annotations: {}, flags: {}, drill: {} };
}

/** Reads stored JSON defensively — an old or hand-edited row must not crash the runner. */
export function parseState(raw: unknown): AttemptState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<AttemptState>;
  return {
    section: typeof r.section === "number" && r.section >= 0 ? Math.floor(r.section) : 0,
    deadline: typeof r.deadline === "string" ? r.deadline : null,
    sectionStartedAt: typeof r.sectionStartedAt === "string" ? r.sectionStartedAt : null,
    answers: r.answers && typeof r.answers === "object" ? r.answers : {},
    essays: r.essays && typeof r.essays === "object" ? r.essays : {},
    annotations: r.annotations && typeof r.annotations === "object" ? r.annotations : {},
    flags: r.flags && typeof r.flags === "object" ? r.flags : {},
    drill: r.drill && typeof r.drill === "object" ? r.drill : {},
  };
}

/** Grace period for network latency after a section's deadline. */
export const DEADLINE_GRACE_MS = 15_000;

export function deadlineFrom(now: Date, minutes: number): string {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export function isExpired(state: AttemptState, now: Date): boolean {
  return state.deadline !== null && now.getTime() > new Date(state.deadline).getTime() + DEADLINE_GRACE_MS;
}
