import type { MockTest, QuestionGroup, QuestionSet } from "./schema";

/**
 * Consistency checks the schema cannot express: numbering, answer keys that point at real
 * options, word limits, and mock tests that add up to a real exam. Pure functions so they
 * run both in `content:validate` and in unit tests.
 */

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const NUMBER_TOKEN = /^[£$€]?\d[\d.,:/-]*(st|nd|rd|th|am|pm|%|kg|km|cm|mm|m|g|ml|l)?$/i;

/**
 * IELTS word limits: "NO MORE THAN TWO WORDS AND/OR A NUMBER" allows two words plus one
 * number ("14 March" fits "ONE WORD AND/OR A NUMBER"). Without the number allowance,
 * numbers count as words.
 */
export function withinWordLimit(text: string, maxWords: number, allowNumber: boolean): boolean {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (!allowNumber) return tokens.length <= maxWords;
  const numbers = tokens.filter((t) => NUMBER_TOKEN.test(t)).length;
  const words = tokens.length - numbers;
  return words <= maxWords && numbers <= Math.max(1, maxWords - words + 1);
}

/** Question numbers a group covers, in order. */
export function groupNumbers(group: QuestionGroup): number[] {
  if (group.type === "mcq_multi") return group.questions.flatMap((q) => q.numbers);
  return group.questions.map((q) => q.n);
}

export function setNumbers(set: QuestionSet): number[] {
  return set.groups.flatMap(groupNumbers);
}

export function checkGroup(group: QuestionGroup): string[] {
  const issues: string[] = [];

  switch (group.type) {
    case "mcq_single":
      for (const q of group.questions) {
        if (!q.options.some((o) => o.key === q.answer)) {
          issues.push(`Q${q.n}: answer "${q.answer}" is not one of the options`);
        }
      }
      break;
    case "mcq_multi":
      for (const q of group.questions) {
        if (q.answers.length !== q.numbers.length) {
          issues.push(`Q${q.numbers.join("-")}: ${q.numbers.length} numbers but ${q.answers.length} answers`);
        }
        for (const a of q.answers) {
          if (!q.options.some((o) => o.key === a)) {
            issues.push(`Q${q.numbers.join("-")}: answer "${a}" is not one of the options`);
          }
        }
      }
      break;
    case "tfng": {
      const allowed = group.variant === "tfng" ? ["TRUE", "FALSE", "NOT GIVEN"] : ["YES", "NO", "NOT GIVEN"];
      for (const q of group.questions) {
        if (!allowed.includes(q.answer)) {
          issues.push(`Q${q.n}: "${q.answer}" is not valid for a ${group.variant} group`);
        }
      }
      break;
    }
    case "matching": {
      const used = new Set<string>();
      for (const q of group.questions) {
        if (!group.options.some((o) => o.key === q.answer)) {
          issues.push(`Q${q.n}: answer "${q.answer}" is not one of the options`);
        }
        if (!group.allowReuse && used.has(q.answer)) {
          issues.push(`Q${q.n}: option "${q.answer}" reused but allowReuse is false`);
        }
        used.add(q.answer);
      }
      break;
    }
    case "completion":
      for (const q of group.questions) {
        const placeholder = `{{${q.n}}}`;
        const inTemplate = group.template?.includes(placeholder) ?? false;
        const inPrompt = q.prompt?.includes(placeholder) ?? false;
        if (!inTemplate && !inPrompt) {
          issues.push(`Q${q.n}: no ${placeholder} blank in the template or prompt`);
        }
        for (const a of q.answers) {
          if (group.wordBank) {
            if (!group.wordBank.some((o) => o.key === a)) {
              issues.push(`Q${q.n}: answer "${a}" is not in the word bank`);
            }
          } else if (!withinWordLimit(a, group.maxWords, group.allowNumber)) {
            issues.push(
              `Q${q.n}: answer "${a}" exceeds the limit (${group.maxWords} word(s)${group.allowNumber ? " and/or a number" : ""})`,
            );
          }
        }
      }
      break;
  }

  return issues;
}

export function checkSet(set: QuestionSet): string[] {
  const issues = set.groups.flatMap((g, i) => checkGroup(g).map((m) => `group ${i + 1}: ${m}`));
  const numbers = setNumbers(set);

  const first = numbers[0];
  numbers.forEach((n, i) => {
    if (n !== first + i) issues.push(`question numbers are not consecutive near Q${n}`);
  });

  return issues;
}

export interface MockLookup {
  sets: Map<string, QuestionSet>;
  writing: Map<string, { task: 1 | 2; module: string }>;
  speaking: Map<string, { part: 1 | 2 | 3 }>;
}

export function checkMock(mock: MockTest, lookup: MockLookup): string[] {
  const issues: string[] = [];

  const section = (ids: string[], skill: "listening" | "reading") => {
    const all: number[] = [];
    ids.forEach((id, i) => {
      const set = lookup.sets.get(id);
      if (!set) return issues.push(`${skill} set "${id}" does not exist`);
      if (set.skill !== skill) issues.push(`"${id}" is ${set.skill}, expected ${skill}`);
      if (set.part !== undefined && set.part !== i + 1) {
        issues.push(`"${id}" is part ${set.part} but placed at position ${i + 1}`);
      }
      if (set.module !== "both" && set.module !== mock.module) {
        issues.push(`"${id}" is for ${set.module}, mock is ${mock.module}`);
      }
      all.push(...setNumbers(set));
    });
    if (all.length !== 40) issues.push(`${skill} has ${all.length} questions, expected 40`);
    all.forEach((n, i) => {
      if (n !== i + 1) issues.push(`${skill} numbering breaks at Q${n} (expected ${i + 1})`);
    });
  };

  section(mock.listening, "listening");
  section(mock.reading, "reading");

  mock.writing.forEach((id, i) => {
    const task = lookup.writing.get(id);
    if (!task) return issues.push(`writing task "${id}" does not exist`);
    if (task.task !== i + 1) issues.push(`"${id}" is Task ${task.task}, placed as Task ${i + 1}`);
    if (task.module !== "both" && task.module !== mock.module) {
      issues.push(`"${id}" is for ${task.module}, mock is ${mock.module}`);
    }
  });

  mock.speaking.forEach((id, i) => {
    const task = lookup.speaking.get(id);
    if (!task) return issues.push(`speaking task "${id}" does not exist`);
    if (task.part !== i + 1) issues.push(`"${id}" is Part ${task.part}, placed as Part ${i + 1}`);
  });

  return issues;
}
