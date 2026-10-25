import type { WritingTask } from "@/lib/content/schema";

/** The three shapes of IELTS writing the assistant knows: an Academic report, a GT letter, an essay. */
export type WritingKind = "report" | "letter" | "essay";
export type LetterTone = "formal" | "semi" | "informal";
export type EssayType = "opinion" | "discussion" | "problem_solution" | "advantages_disadvantages" | "two_part";

export const ESSAY_TYPES: readonly EssayType[] = ["opinion", "discussion", "problem_solution", "advantages_disadvantages", "two_part"];
export const LETTER_TONES: readonly LetterTone[] = ["formal", "semi", "informal"];

export interface WritingContext {
  kind: WritingKind;
  minWords: number;
  /** Letters: the register the task asks for. */
  tone?: LetterTone;
  /** Essays: the question type. */
  essayType?: EssayType;
}

type TaskShape = Pick<WritingTask, "task" | "taskType" | "minWords">;

export function writingKind(task: Pick<WritingTask, "task" | "taskType">): WritingKind {
  if (task.task === 2) return "essay";
  return task.taskType.startsWith("letter_") ? "letter" : "report";
}

export function letterTone(taskType: WritingTask["taskType"]): LetterTone {
  if (taskType === "letter_informal") return "informal";
  if (taskType === "letter_semi_formal") return "semi";
  return "formal";
}

function isEssayType(v: string): v is EssayType {
  return (ESSAY_TYPES as readonly string[]).includes(v);
}

export function writingContext(task: TaskShape): WritingContext {
  const kind = writingKind(task);
  return {
    kind,
    minWords: task.minWords,
    ...(kind === "letter" ? { tone: letterTone(task.taskType) } : {}),
    ...(kind === "essay" ? { essayType: isEssayType(task.taskType) ? task.taskType : "opinion" } : {}),
  };
}

/** Whether contractions count against the learner: everything except an informal letter. */
export function isFormalRegister(ctx: Pick<WritingContext, "kind" | "tone">): boolean {
  return !(ctx.kind === "letter" && ctx.tone === "informal");
}
