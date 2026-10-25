import type { LetterTone, WritingContext } from "./task-kind";

/** Ready-made phrases per task type; inserting one is a starting point, not a template to memorise. */

export type PhraseGroupId =
  | "overview" | "increase" | "decrease" | "comparison" | "sequence"
  | "opinion" | "concession" | "examples" | "conclusion"
  | "opening" | "purpose" | "closing";

export interface PhraseGroup {
  id: PhraseGroupId;
  phrases: readonly string[];
}

const REPORT: readonly PhraseGroup[] = [
  { id: "overview", phrases: ["Overall, it is clear that", "In general,", "The most striking feature is that", "It is evident that"] },
  { id: "increase", phrases: ["rose steadily from … to …", "increased sharply to", "saw a significant rise in", "climbed to a peak of", "more than doubled"] },
  { id: "decrease", phrases: ["fell dramatically to", "declined gradually from … to …", "dropped slightly to", "reached a low of", "halved"] },
  { id: "comparison", phrases: ["whereas", "compared with", "in contrast,", "was considerably higher than", "was roughly the same as", "the figure for … was twice that of"] },
  { id: "sequence", phrases: ["At the first stage,", "Following this,", "Once this has been done,", "In the final stage,", "Over the period,"] },
];

const ESSAY: readonly PhraseGroup[] = [
  { id: "opinion", phrases: ["I strongly believe that", "In my view,", "I would argue that", "I partly agree with this view because", "This essay will argue that"] },
  { id: "concession", phrases: ["Admittedly,", "While it is true that", "Although some people argue that", "Despite this,", "Even so,"] },
  { id: "examples", phrases: ["For example,", "For instance,", "such as", "A clear example of this is", "This can be seen in"] },
  { id: "conclusion", phrases: ["In conclusion,", "To sum up,", "On balance,", "Taking everything into account,", "For these reasons, I believe that"] },
];

const OPENING: Readonly<Record<LetterTone, readonly string[]>> = {
  formal: ["Dear Sir or Madam,", "I am writing to complain about", "I am writing to enquire about", "I am writing with regard to"],
  semi: ["Dear Mr …,", "Dear Ms …,", "I am writing to let you know that", "I hope you do not mind me writing to ask"],
  informal: ["Dear …,", "Hi …,", "Thanks so much for your letter.", "It's been ages since I last wrote!"],
};

const PURPOSE: Readonly<Record<LetterTone, readonly string[]>> = {
  formal: ["I would be grateful if you could", "I would like to request", "Please find attached", "I trust this matter will be resolved promptly."],
  semi: ["I was wondering whether you could", "Would it be possible to", "I would appreciate it if you could", "Thank you in advance for your help."],
  informal: ["I was wondering if you could", "Guess what?", "Could you do me a favour?", "Anyway, I'd better go now."],
};

const CLOSING: Readonly<Record<LetterTone, readonly string[]>> = {
  formal: ["I look forward to hearing from you.", "Yours faithfully,"],
  semi: ["I look forward to your reply.", "Yours sincerely,", "Kind regards,"],
  informal: ["Write back soon!", "Can't wait to see you.", "Best wishes,", "Take care,"],
};

export function phraseBank(ctx: WritingContext, tone?: LetterTone): readonly PhraseGroup[] {
  if (ctx.kind === "report") return REPORT;
  if (ctx.kind === "essay") return ESSAY;
  const t = tone ?? ctx.tone ?? "formal";
  return [
    { id: "opening", phrases: OPENING[t] },
    { id: "purpose", phrases: PURPOSE[t] },
    { id: "closing", phrases: CLOSING[t] },
  ];
}
