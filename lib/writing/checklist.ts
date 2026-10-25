import { detectGreeting, detectSignOff, EXPECTED_SIGN_OFF, signOffMatches } from "./letters";
import { isFormalRegister, type WritingContext } from "./task-kind";
import { phrasePattern } from "./text";

/** Task checks; each id has a pass and a fail message in `t.assist.checks`. */
export type CheckId =
  | "minLength"
  | "maxLength"
  | "overview"
  | "noOpinion"
  | "position"
  | "paragraphs"
  | "greeting"
  | "greetingTone"
  | "signOff"
  | "signOffMatch"
  | "contractions";

export interface Check {
  id: CheckId;
  pass: boolean;
  /** How loudly a failed check is shown. */
  severity: "warn" | "info";
  params?: Record<string, string | number>;
}

const OVERVIEW_MARKERS = [
  "overall", "in general", "generally speaking", "it is clear that", "it is evident that", "it is apparent that", "it can be seen that",
  "clearly", "in summary", "to sum up", "the most striking feature", "the most noticeable feature", "the main trend",
];

const OPINION_MARKERS = [
  "i think", "i believe", "in my opinion", "in my view", "i feel", "personally", "i agree", "i disagree", "i strongly", "i partly",
  "i completely", "i would argue", "from my perspective", "from my point of view", "it seems to me", "my view is", "i am convinced",
  "this essay will argue", "this essay argues", "i firmly", "i would say",
];

const CONTRACTION = /\b[a-z]+(?:n['’]t|['’](?:re|ve|ll|d|m))\b|\b(?:it|that|there|what|he|she|let|here|who|where)['’]s\b/gi;

function hasAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => new RegExp(`(?<![\\w'’])${phrasePattern(p)}(?![\\w'’])`, "i").test(text));
}

export function findContractions(text: string): string[] {
  return [...new Set((text.match(CONTRACTION) ?? []).map((c) => c.toLowerCase().replace("’", "'")))];
}

function lengthChecks(words: number, minWords: number): Check[] {
  const checks: Check[] = [{ id: "minLength", pass: words >= minWords, severity: "warn", params: { n: minWords, words } }];
  const max = Math.round(minWords * 1.5);
  if (words > max) checks.push({ id: "maxLength", pass: false, severity: "info", params: { n: max, words } });
  return checks;
}

function reportChecks(text: string): Check[] {
  return [
    { id: "overview", pass: hasAny(text, OVERVIEW_MARKERS), severity: "warn" },
    { id: "noOpinion", pass: !hasAny(text, OPINION_MARKERS), severity: "warn" },
  ];
}

function essayChecks(text: string, paragraphs: number, ctx: WritingContext): Check[] {
  const needsPosition = ctx.essayType !== "problem_solution" && ctx.essayType !== "two_part";
  return [
    { id: "position", pass: hasAny(text, OPINION_MARKERS), severity: needsPosition ? "warn" : "info" },
    { id: "paragraphs", pass: paragraphs >= 4, severity: "warn", params: { n: 4, count: paragraphs } },
  ];
}

function letterChecks(paragraphs: readonly string[], ctx: WritingContext): Check[] {
  const greeting = detectGreeting(paragraphs);
  const signOff = detectSignOff(paragraphs);
  const expectedTone = ctx.tone ?? "formal";
  const checks: Check[] = [{ id: "greeting", pass: greeting !== null, severity: "warn" }];
  if (greeting) {
    checks.push({ id: "greetingTone", pass: greeting.tone === expectedTone, severity: "warn", params: { greeting: greeting.text } });
  }
  checks.push({ id: "signOff", pass: signOff !== null, severity: "warn", params: { expected: EXPECTED_SIGN_OFF[greeting?.tone ?? expectedTone] } });
  if (greeting && signOff) {
    checks.push({
      id: "signOffMatch",
      pass: signOffMatches(greeting.tone, signOff.tone),
      severity: "warn",
      params: { greeting: greeting.text, signOff: signOff.text, expected: EXPECTED_SIGN_OFF[greeting.tone] },
    });
  }
  return checks;
}

/** The checklist for one answer. Empty text gets no checks: there is nothing to judge yet. */
export function taskChecklist(text: string, paragraphs: readonly string[], words: number, ctx: WritingContext): Check[] {
  if (words === 0) return [];
  const byKind =
    ctx.kind === "report" ? reportChecks(text) : ctx.kind === "essay" ? essayChecks(text, paragraphs.length, ctx) : letterChecks(paragraphs, ctx);
  const contractions = isFormalRegister(ctx) ? findContractions(text) : [];
  return [
    ...lengthChecks(words, ctx.minWords),
    ...byKind,
    ...(isFormalRegister(ctx)
      ? [{ id: "contractions" as const, pass: contractions.length === 0, severity: "info" as const, params: { list: contractions.slice(0, 5).join(", ") } }]
      : []),
  ];
}
