import type { MockTest, QuestionSet } from "@/lib/content/schema";
import type { AnswerMap, GradedItem } from "@/lib/scoring/grade";

/**
 * An attempt is a sequence of sections. A practice set is one section; the placement test
 * and a mock test are several, taken in order with their own timers.
 */

export type Section =
  | { kind: "sets"; skill: "listening" | "reading" | "grammar"; setIds: string[]; minutes: number }
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

export function emptyState(): AttemptState {
  return { section: 0, deadline: null, sectionStartedAt: null, answers: {}, essays: {} };
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
