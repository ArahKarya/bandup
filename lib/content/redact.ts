import type { QuestionGroup, QuestionSet } from "./schema";

/**
 * Removes answer keys, explanations and evidence before a set is sent to the browser.
 * Grading happens on the server against the stored payload, so the client never needs them.
 * The shape is kept (empty strings/arrays) so the same renderer types apply.
 */
function redactGroup(group: QuestionGroup): QuestionGroup {
  switch (group.type) {
    case "mcq_single":
      return { ...group, questions: group.questions.map(({ explanation, evidence, ...q }) => ({ ...q, answer: "" })) };
    case "mcq_multi":
      return { ...group, questions: group.questions.map(({ explanation, evidence, ...q }) => ({ ...q, answers: [] })) };
    case "tfng":
      return { ...group, questions: group.questions.map(({ explanation, evidence, ...q }) => ({ ...q, answer: "NOT GIVEN" as const })) };
    case "matching":
      return { ...group, questions: group.questions.map(({ explanation, evidence, ...q }) => ({ ...q, answer: "" })) };
    case "completion":
      return { ...group, questions: group.questions.map(({ explanation, evidence, ...q }) => ({ ...q, answers: [] })) };
  }
}

/**
 * Listening scripts stay in the payload: the browser reads them aloud with text-to-speech.
 * During a mock test the transcript is simply not displayed.
 */
export function redactSet(set: QuestionSet): QuestionSet {
  return { ...set, groups: set.groups.map(redactGroup) };
}
