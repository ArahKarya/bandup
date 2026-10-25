import { z } from "zod";

/** Validates a model's assessment and coerces scores onto the half-band scale. */

const band = z.coerce.number().transform((n) => Math.min(9, Math.max(0, Math.round(n * 2) / 2)));

const feedbackBase = {
  summary: z.string().max(2000).default(""),
  strengths: z.array(z.string().max(600)).max(8).default([]),
  improvements: z.array(z.string().max(600)).max(10).default([]),
  corrections: z
    .array(z.object({ original: z.string().max(400), suggestion: z.string().max(400), note: z.string().max(400).default("") }))
    .max(12)
    .default([]),
};

export const writingAssessment = z.object({
  criteria: z.object({ ta: band, cc: band, lr: band, gra: band }),
  ...feedbackBase,
});

export const speakingAssessment = z.object({
  criteria: z.object({ fc: band, lr: band, gra: band, p: band }),
  ...feedbackBase,
});

export type WritingAssessment = z.infer<typeof writingAssessment>;
export type SpeakingAssessment = z.infer<typeof speakingAssessment>;

/** Pulls the first JSON object out of a reply that may include fences or stray prose. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The model did not return JSON.");
  return JSON.parse(body.slice(start, end + 1));
}

export function parseWriting(text: string): WritingAssessment {
  return writingAssessment.parse(extractJson(text));
}

export function parseSpeaking(text: string): SpeakingAssessment {
  return speakingAssessment.parse(extractJson(text));
}
