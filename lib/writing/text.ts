/**
 * Small, dependency-free text helpers shared by the writing analysis and the speaking metrics.
 * They are heuristics for feedback, not a parser: good enough to count and point, never to grade.
 */

/** Word tokens in reading order (letters, digits, inner apostrophes and hyphens). */
export function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[’‘]/g, "'").match(/[a-z0-9]+(?:['-][a-z0-9]+)*/g) ?? [];
}

/** Non-empty lines; a line break in a textarea is how learners start a new paragraph. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => tokenize(p).length > 0);
}

/** Abbreviations whose full stop does not end a sentence. */
const ABBREVIATIONS = /\b(e\.g|i\.e|etc|mr|mrs|ms|dr|prof|vs|approx|no)\./gi;

/** Sentences, split on . ! ? followed by space or the end, and on line breaks. */
export function splitSentences(text: string): string[] {
  const guarded = text.replace(ABBREVIATIONS, (m) => m.replace(/\./g, "\u0000"));
  return guarded
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((s) => s.replace(/\u0000/g, ".").trim())
    .filter((s) => tokenize(s).length > 0);
}

/** Function words that say nothing about vocabulary range. */
export const STOPWORDS: ReadonlySet<string> = new Set(
  (
    "a about above after again against all also am an and any are as at be because been before being below between both but by can could " +
    "did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into " +
    "is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should " +
    "so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were " +
    "what when where which while who whom why will with would you your yours yourself yourselves it's i'm don't doesn't didn't can't won't " +
    "isn't aren't wasn't weren't there's that's they're we're you're i've we've they've i'll we'll i'd may might must shall one many much " +
    "even well however therefore although though whereas moreover furthermore thus hence yes yeah okay ok um uh er erm like really get got"
  ).split(" "),
);

/** Folds simple English plurals so "cities" and "city" count as one word. */
export function lemma(word: string): string {
  if (word.length <= 3) return word;
  if (/[^aeiou]ies$/.test(word)) return `${word.slice(0, -3)}y`;
  if (/(ss|sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  if (/(ss|us|is|ous)$/.test(word)) return word;
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

export interface WordCount {
  word: string;
  count: number;
}

/** Most frequent content words (stopwords and very short words left out), most frequent first. */
export function repeatedWords(tokens: readonly string[], limit = 5, minCount = 3): WordCount[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    if (token.length < 3 || STOPWORDS.has(token) || /^\d/.test(token)) continue;
    const key = lemma(token);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A case-insensitive pattern for a phrase that tolerates any whitespace and either apostrophe. */
export function phrasePattern(phrase: string): string {
  return phrase
    .trim()
    .split(/\s+/)
    .map((part) => escapeRegExp(part).replace(/['’]/g, "['’]"))
    .join("\\s+");
}
