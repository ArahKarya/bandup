import { countWords } from "@/lib/content/check";
import { taskChecklist, type Check } from "./checklist";
import { summariseLinking, type LinkingSummary } from "./linking";
import type { WritingContext } from "./task-kind";
import { repeatedWords, round1, splitParagraphs, splitSentences, tokenize, type WordCount } from "./text";

/** Sentences longer than this are hard to control; the panel flags them. */
export const LONG_SENTENCE_WORDS = 40;

export interface WritingAnalysis {
  words: number;
  paragraphs: { index: number; words: number }[];
  sentences: number;
  avgSentenceLength: number;
  longestSentence: { words: number; text: string } | null;
  longSentences: number;
  linking: LinkingSummary;
  repeated: WordCount[];
  checks: Check[];
}

/**
 * A live, rule-based read of an answer. Everything here is indicative: it counts and points so
 * the learner can self-correct, and never claims to predict a band.
 */
export function analyzeWriting(text: string, ctx: WritingContext): WritingAnalysis {
  const tokens = tokenize(text);
  // Same count as the editor shows, so the checklist and the counter never disagree.
  const words = countWords(text);
  const paragraphs = splitParagraphs(text);
  const sentences = splitSentences(text).map((s) => ({ text: s, words: tokenize(s).length }));
  const longest = sentences.reduce<{ words: number; text: string } | null>((best, s) => (!best || s.words > best.words ? s : best), null);

  return {
    words,
    paragraphs: paragraphs.map((p, index) => ({ index, words: countWords(p) })),
    sentences: sentences.length,
    avgSentenceLength: sentences.length > 0 ? round1(sentences.reduce((n, s) => n + s.words, 0) / sentences.length) : 0,
    longestSentence: longest,
    longSentences: sentences.filter((s) => s.words > LONG_SENTENCE_WORDS).length,
    linking: summariseLinking(text),
    repeated: repeatedWords(tokens),
    checks: taskChecklist(text, paragraphs, words, ctx),
  };
}
