import { repeatedWords, round1, splitSentences, tokenize, type WordCount } from "@/lib/writing/text";

/**
 * Fluency and vocabulary indicators computed from a transcript and the recording length. They are
 * transcript-based and indicative only: speech recognition drops fillers and pauses, and a typed
 * transcript has no timing at all.
 */

export const FILLERS = ["um", "uh", "er", "erm", "like", "you know", "i mean", "sort of", "kind of", "actually", "basically"] as const;
export type Filler = (typeof FILLERS)[number];

/** Spelling variants that speech recognisers and learners produce for hesitation sounds. */
const HESITATION: Readonly<Record<string, Filler>> = {
  um: "um", umm: "um", ummm: "um", hmm: "um", uh: "uh", uhh: "uh", uhm: "um", er: "er", err: "er", erm: "erm", ehm: "erm",
};

const DETERMINERS = new Set(["what", "which", "this", "that", "the", "a", "an", "any", "some", "every", "same", "different", "another", "one", "those", "these", "all", "no", "each", "my", "your", "his", "her", "our", "their"]);
const KNOW_COMPLEMENTS = new Set(["that", "what", "how", "why", "where", "when", "who", "whether", "if", "the", "a", "an", "about", "it", "him", "her", "them"]);
const KNOW_AUXILIARIES = new Set(["do", "did", "don't", "didn't", "if", "would", "will", "should", "may", "might"]);
const MEAN_COMPLEMENTS = new Set(["that", "it", "to", "this", "what"]);

export const MATTR_WINDOW = 50;

export interface SpeakingMetrics {
  words: number;
  durationSec: number | null;
  wpm: number | null;
  fillers: { total: number; per100Words: number; perMinute: number | null; items: { filler: Filler; count: number }[] };
  /** Type-token ratio over the whole answer (falls as answers get longer). */
  ttr: number | null;
  /** Moving-average TTR over 50-word windows: comparable across answer lengths. */
  mattr: number | null;
  repeated: WordCount[];
  /** Only when the transcript is punctuated. */
  sentences: number | null;
  avgSentenceLength: number | null;
}

/** Comma-aware tokens: `like,` is usually a filler, `like a dream` usually is not. */
interface Tok {
  w: string;
  commaAfter: boolean;
  /** Any punctuation follows (a clause boundary). */
  pauseAfter: boolean;
}

function toks(transcript: string): Tok[] {
  const parts = transcript.toLowerCase().replace(/[’‘]/g, "'").match(/[a-z0-9]+(?:['-][a-z0-9]+)*|[,;.!?]/g) ?? [];
  const out: Tok[] = [];
  parts.forEach((p, i) => {
    if (/^[,;.!?]$/.test(p)) return;
    out.push({ w: p, commaAfter: /^[,;]$/.test(parts[i + 1] ?? ""), pauseAfter: /^[,;.!?]$/.test(parts[i + 1] ?? "") });
  });
  return out;
}

/** Which filler (if any) starts at token i, and how many tokens it spans. */
function fillerAt(t: readonly Tok[], i: number): { filler: Filler; span: number } | null {
  const w = t[i].w;
  const next = t[i + 1]?.w;
  const prev = t[i - 1]?.w;
  if (HESITATION[w]) return { filler: HESITATION[w], span: 1 };
  if (w === "actually" || w === "basically") return { filler: w, span: 1 };
  if (w === "like") {
    // Heuristic: followed by a comma ("it was, like, huge"), doubled, or next to a hesitation sound.
    const nearHesitation = (next !== undefined && HESITATION[next] !== undefined) || (prev !== undefined && HESITATION[prev] !== undefined);
    const filler = t[i].commaAfter || next === "like" || nearHesitation;
    return filler ? { filler: "like", span: 1 } : null;
  }
  if ((w === "kind" || w === "sort") && next === "of") {
    return prev !== undefined && DETERMINERS.has(prev) ? null : { filler: w === "kind" ? "kind of" : "sort of", span: 2 };
  }
  if (w === "you" && next === "know") {
    const after = t[i + 2]?.w;
    const literal = (prev !== undefined && KNOW_AUXILIARIES.has(prev)) || (after !== undefined && KNOW_COMPLEMENTS.has(after) && !t[i + 1].pauseAfter);
    return literal ? null : { filler: "you know", span: 2 };
  }
  if (w === "i" && next === "mean") {
    const after = t[i + 2]?.w;
    // "what I mean" and "I mean it" are literal.
    const literal = prev === "what" || (after !== undefined && MEAN_COMPLEMENTS.has(after) && !t[i + 1].pauseAfter);
    return literal ? null : { filler: "i mean", span: 2 };
  }
  return null;
}

export function countFillers(transcript: string): { filler: Filler; count: number }[] {
  const t = toks(transcript);
  const counts = new Map<Filler, number>();
  for (let i = 0; i < t.length; ) {
    const hit = fillerAt(t, i);
    if (hit) counts.set(hit.filler, (counts.get(hit.filler) ?? 0) + 1);
    i += hit?.span ?? 1;
  }
  return FILLERS.filter((f) => counts.has(f)).map((filler) => ({ filler, count: counts.get(filler) ?? 0 })).sort((a, b) => b.count - a.count);
}

export function typeTokenRatio(words: readonly string[]): number | null {
  return words.length === 0 ? null : new Set(words).size / words.length;
}

/** MATTR (Covington & McFall, 2010); shorter answers fall back to the plain TTR. */
export function movingAverageTtr(words: readonly string[], window = MATTR_WINDOW): number | null {
  if (words.length < window) return typeTokenRatio(words);
  const counts = new Map<string, number>();
  for (const w of words.slice(0, window)) counts.set(w, (counts.get(w) ?? 0) + 1);
  let total = counts.size / window;
  for (let i = window; i < words.length; i++) {
    const out = words[i - window];
    const left = (counts.get(out) ?? 1) - 1;
    if (left === 0) counts.delete(out);
    else counts.set(out, left);
    counts.set(words[i], (counts.get(words[i]) ?? 0) + 1);
    total += counts.size / window;
  }
  return total / (words.length - window + 1);
}

const r3 = (n: number | null): number | null => (n === null ? null : Math.round(n * 1000) / 1000);

export function speakingMetrics(transcript: string, durationSec: number | null | undefined): SpeakingMetrics {
  const words = tokenize(transcript);
  const fillerHesitations = new Set(Object.keys(HESITATION));
  const lexical = words.filter((w) => !fillerHesitations.has(w));
  const minutes = durationSec && durationSec > 0 ? durationSec / 60 : null;
  const items = countFillers(transcript);
  const total = items.reduce((n, f) => n + f.count, 0);
  const punctuated = /[.!?]/.test(transcript);
  const sentences = punctuated ? splitSentences(transcript) : [];
  return {
    words: words.length,
    durationSec: minutes ? durationSec ?? null : null,
    wpm: minutes && words.length > 0 ? Math.round(words.length / minutes) : null,
    fillers: {
      total,
      per100Words: words.length > 0 ? round1((total / words.length) * 100) : 0,
      perMinute: minutes ? round1(total / minutes) : null,
      items,
    },
    ttr: r3(typeTokenRatio(lexical)),
    mattr: r3(movingAverageTtr(lexical)),
    repeated: repeatedWords(words, 5, 3),
    sentences: punctuated ? sentences.length : null,
    avgSentenceLength: punctuated && sentences.length > 0 ? round1(words.length / sentences.length) : null,
  };
}

export type Level = "low" | "ok" | "high";

/** ~120–160 words per minute is a comfortable, natural pace for an IELTS answer. */
export function wpmLevel(wpm: number): Level {
  return wpm < 110 ? "low" : wpm > 170 ? "high" : "ok";
}

/** More than about 6 fillers per 100 words is noticeable to a listener. */
export function fillerLevel(per100Words: number): Level {
  return per100Words > 6 ? "high" : "ok";
}

/** MATTR over 50-word windows: below ~0.6 suggests a narrow range of words for spoken English. */
export function diversityLevel(mattr: number): Level {
  return mattr < 0.6 ? "low" : mattr > 0.75 ? "high" : "ok";
}
