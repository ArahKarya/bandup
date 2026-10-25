import { phrasePattern } from "./text";

/** Cohesive devices grouped by what they do, as taught for Coherence & Cohesion. */
export const LINK_FUNCTIONS = ["addition", "contrast", "cause", "example", "sequence", "conclusion"] as const;
export type LinkFunction = (typeof LINK_FUNCTIONS)[number];

/**
 * A curated list, not every possible connector. Ambiguous words ("so", "since", "yet", "first")
 * are left out because they are as often not linking devices as they are.
 */
export const LINKING_DEVICES: Readonly<Record<LinkFunction, readonly string[]>> = {
  addition: ["in addition", "additionally", "moreover", "furthermore", "also", "as well as", "besides", "what is more", "not only", "another"],
  contrast: [
    "however", "on the other hand", "nevertheless", "nonetheless", "although", "even though", "whereas", "while", "in contrast",
    "by contrast", "despite", "in spite of", "but", "conversely", "on the contrary", "unlike",
  ],
  cause: [
    "because", "because of", "due to", "as a result", "as a consequence", "therefore", "consequently", "thus", "hence", "owing to",
    "for this reason", "so that", "leads to", "led to", "lead to", "results in", "resulted in", "result in",
  ],
  example: ["for example", "for instance", "such as", "in particular", "particularly", "namely", "to illustrate", "a case in point"],
  sequence: [
    "firstly", "first of all", "to begin with", "secondly", "thirdly", "finally", "lastly", "then", "next", "subsequently",
    "afterwards", "after that", "following this", "eventually", "meanwhile",
  ],
  conclusion: [
    "in conclusion", "to conclude", "to sum up", "in summary", "to summarise", "to summarize", "overall", "all in all",
    "in short", "on balance", "taking everything into account",
  ],
};

export interface LinkMatch {
  start: number;
  end: number;
  /** The device as listed (lowercase), not as typed. */
  phrase: string;
  fn: LinkFunction;
}

interface Entry {
  phrase: string;
  fn: LinkFunction;
  re: RegExp;
}

// Longest first, so "because of" wins over "because" and "on the other hand" over "other".
const ENTRIES: readonly Entry[] = LINK_FUNCTIONS.flatMap((fn) =>
  LINKING_DEVICES[fn].map((phrase) => ({ phrase, fn, re: new RegExp(`(?<![\\w'’-])${phrasePattern(phrase)}(?![\\w'’-])`, "gi") })),
).sort((a, b) => b.phrase.length - a.phrase.length);

/** Every linking device in the text, in reading order, without overlaps. */
export function findLinkingDevices(text: string): LinkMatch[] {
  const taken: LinkMatch[] = [];
  for (const entry of ENTRIES) {
    for (const m of text.matchAll(entry.re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (taken.some((t) => start < t.end && end > t.start)) continue;
      taken.push({ start, end, phrase: entry.phrase, fn: entry.fn });
    }
  }
  return [...taken].sort((a, b) => a.start - b.start);
}

export interface LinkingSummary {
  matches: LinkMatch[];
  total: number;
  /** Distinct devices used. */
  distinct: number;
  /** How many of the six functions appear at least once. */
  functionsUsed: number;
  byFunction: Record<LinkFunction, { phrase: string; count: number }[]>;
}

export function summariseLinking(text: string): LinkingSummary {
  const matches = findLinkingDevices(text);
  const byFunction = Object.fromEntries(
    LINK_FUNCTIONS.map((fn) => {
      const counts = new Map<string, number>();
      for (const m of matches) if (m.fn === fn) counts.set(m.phrase, (counts.get(m.phrase) ?? 0) + 1);
      return [fn, [...counts.entries()].map(([phrase, count]) => ({ phrase, count })).sort((a, b) => b.count - a.count)];
    }),
  ) as Record<LinkFunction, { phrase: string; count: number }[]>;
  return {
    matches,
    total: matches.length,
    distinct: new Set(matches.map((m) => m.phrase)).size,
    functionsUsed: LINK_FUNCTIONS.filter((fn) => byFunction[fn].length > 0).length,
    byFunction,
  };
}
