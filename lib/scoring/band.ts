/**
 * Raw-score → band conversion and IELTS rounding rules.
 *
 * The conversion tables are the widely published approximations; the official tables vary
 * slightly between test versions, so every band the app produces is labelled an estimate.
 */

export type Band = number;

/** [minimum raw score, band], highest first. */
type Table = readonly (readonly [number, Band])[];

const LISTENING: Table = [
  [39, 9], [37, 8.5], [35, 8], [32, 7.5], [30, 7], [26, 6.5], [23, 6], [18, 5.5],
  [16, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1],
];

const READING_ACADEMIC: Table = [
  [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5],
  [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5], [2, 2], [1, 1],
];

const READING_GENERAL: Table = [
  [40, 9], [39, 8.5], [37, 8], [36, 7.5], [34, 7], [32, 6.5], [30, 6], [27, 5.5],
  [23, 5], [19, 4.5], [15, 4], [12, 3.5], [9, 3], [6, 2.5], [3, 2], [1, 1],
];

function lookup(table: Table, raw: number): Band {
  const row = table.find(([min]) => raw >= min);
  return row ? row[1] : 0;
}

export function listeningBand(raw: number): Band {
  return lookup(LISTENING, raw);
}

export function readingBand(raw: number, module: "academic" | "general"): Band {
  return lookup(module === "general" ? READING_GENERAL : READING_ACADEMIC, raw);
}

/**
 * Estimated band for a set shorter than a full section: the raw score is scaled to 40
 * marks first. Reading defaults to the Academic table.
 */
export function scaledBand(
  raw: number,
  max: number,
  skill: "listening" | "reading",
  module: "academic" | "general" = "academic",
): Band {
  if (max <= 0) return 0;
  const scaled = Math.round((raw / max) * 40);
  return skill === "listening" ? listeningBand(scaled) : readingBand(scaled, module);
}

/** Rounds down to the half band below (used for criteria averages). */
export function floorHalf(value: number): Band {
  return Math.floor(value * 2 + 1e-9) / 2;
}

/**
 * Overall band rounding: an average ending in .25 rounds up to .5, one ending in .75
 * rounds up to the next whole band, anything else rounds down to the nearest half.
 */
export function roundOverall(value: number): Band {
  const whole = Math.floor(value);
  const frac = value - whole;
  if (frac < 0.25 - 1e-9) return whole;
  if (frac < 0.75 - 1e-9) return whole + 0.5;
  return whole + 1;
}

export function overallBand(bands: Band[]): Band {
  if (bands.length === 0) return 0;
  return roundOverall(bands.reduce((a, b) => a + b, 0) / bands.length);
}

export interface WritingCriteria {
  /** Task Achievement (Task 1) or Task Response (Task 2). */
  ta: Band;
  cc: Band;
  lr: Band;
  gra: Band;
}

export interface SpeakingCriteria {
  fc: Band;
  lr: Band;
  gra: Band;
  p: Band;
}

/**
 * Writing task and Speaking bands round the criteria average *down* to the half band, as
 * IELTS does for criterion averages (6.75 → 6.5). Only the overall band rounds up at .25/.75.
 */
export function taskBand(c: WritingCriteria): Band {
  return floorHalf((c.ta + c.cc + c.lr + c.gra) / 4);
}

/** Task 2 carries twice the weight of Task 1. */
export function writingBand(task1: Band, task2: Band): Band {
  return Math.round(((task1 + 2 * task2) / 3) * 2) / 2;
}

export function speakingBand(c: SpeakingCriteria): Band {
  return floorHalf((c.fc + c.lr + c.gra + c.p) / 4);
}
