import type { LetterTone } from "./task-kind";

/** Greetings and sign-offs, and the register each one signals in a GT letter. */

export interface Detected {
  text: string;
  tone: LetterTone;
}

const GREETINGS: readonly { re: RegExp; tone: LetterTone }[] = [
  { re: /^(dear\s+sir\s*(or|\/)\s*madam|dear\s+(sir|madam|sirs)|to\s+whom\s+it\s+may\s+concern)\b/i, tone: "formal" },
  { re: /^dear\s+(mr|mrs|ms|miss|dr|prof|professor)\.?\s+\S+/i, tone: "semi" },
  { re: /^(dear|hi|hello|hey)\s+[a-z]+/i, tone: "informal" },
  { re: /^(hi|hello|hey)\b/i, tone: "informal" },
];

const SIGN_OFFS: readonly { re: RegExp; tone: LetterTone }[] = [
  { re: /^yours\s+faithfully\b/i, tone: "formal" },
  { re: /^(yours\s+sincerely|sincerely(\s+yours)?|kind\s+regards|best\s+regards|warm\s+regards|regards)\b/i, tone: "semi" },
  { re: /^(best\s+wishes|all\s+the\s+best|warm\s+wishes|lots\s+of\s+love|love|take\s+care|cheers|see\s+you\s+soon|speak\s+soon|best)\b/i, tone: "informal" },
];

/** What each greeting style is normally closed with. */
export const EXPECTED_SIGN_OFF: Readonly<Record<LetterTone, string>> = {
  formal: "Yours faithfully",
  semi: "Yours sincerely",
  informal: "Best wishes",
};

export const DEFAULT_GREETING: Readonly<Record<LetterTone, string>> = {
  formal: "Dear Sir or Madam,",
  semi: "Dear Mr …,",
  informal: "Dear …,",
};

function detect(line: string, table: readonly { re: RegExp; tone: LetterTone }[]): Detected | null {
  const trimmed = line.trim();
  const hit = table.find((g) => g.re.test(trimmed));
  return hit ? { text: trimmed.replace(/[,.:;!]+$/, ""), tone: hit.tone } : null;
}

export function detectGreeting(paragraphs: readonly string[]): Detected | null {
  return paragraphs.length > 0 ? detect(paragraphs[0], GREETINGS) : null;
}

/** The sign-off is one of the last three lines (a name and a postscript may follow it). */
export function detectSignOff(paragraphs: readonly string[]): Detected | null {
  for (const line of paragraphs.slice(-3).reverse()) {
    const hit = detect(line, SIGN_OFFS);
    if (hit) return hit;
  }
  return null;
}

/**
 * Semi-formal letters accept "Kind regards" as well as "Yours sincerely"; informal ones accept
 * any informal close. Formal letters ("Dear Sir or Madam") need "Yours faithfully".
 */
export function signOffMatches(greeting: LetterTone, signOff: LetterTone): boolean {
  return greeting === signOff;
}
