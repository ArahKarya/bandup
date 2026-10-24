import { z } from "zod";

/**
 * Content schema — the contract between the files under `content/` and the app.
 *
 * Every lesson, deck, question set, task and mock test is a plain file validated here,
 * so contributors can add material with a pull request and CI rejects anything malformed.
 * See CONTENT_GUIDE.md for authoring notes.
 */

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "ids are lowercase kebab-case");

export const examModule = z.enum(["academic", "general", "both"]);
export const difficulty = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/**
 * Question categories used for analytics (the weakness heatmap). They follow the
 * official IELTS task-type names; the renderer is chosen by `group.type`, not by this.
 */
export const QUESTION_CATEGORIES = [
  "multiple_choice",
  "true_false_not_given",
  "yes_no_not_given",
  "matching_headings",
  "matching_information",
  "matching_features",
  "matching_sentence_endings",
  "sentence_completion",
  "summary_completion",
  "note_completion",
  "table_completion",
  "form_completion",
  "flow_chart_completion",
  "diagram_labelling",
  "map_labelling",
  "short_answer",
  "grammar",
] as const;
export const questionCategory = z.enum(QUESTION_CATEGORIES);

const option = z.object({ key: z.string().min(1).max(4), text: z.string().min(1) });

const groupBase = {
  category: questionCategory,
  instructions: z.string().min(1),
  /** Optional image under content/assets, e.g. a map or diagram (SVG preferred). */
  image: z.string().optional(),
};

const explained = {
  /** Why the answer is right; shown on the review screen. */
  explanation: z.string().optional(),
  /** Paragraph label (reading) or script line index (listening) where the answer is found. */
  evidence: z.string().optional(),
};

export const mcqSingleGroup = z.object({
  type: z.literal("mcq_single"),
  ...groupBase,
  questions: z
    .array(
      z.object({
        n: z.number().int().positive(),
        prompt: z.string().min(1),
        options: z.array(option).min(3),
        answer: z.string().min(1),
        ...explained,
      }),
    )
    .min(1),
});

/** "Choose TWO letters" — one item that is worth `numbers.length` marks. */
export const mcqMultiGroup = z.object({
  type: z.literal("mcq_multi"),
  ...groupBase,
  questions: z
    .array(
      z.object({
        numbers: z.array(z.number().int().positive()).min(2),
        prompt: z.string().min(1),
        options: z.array(option).min(4),
        answers: z.array(z.string().min(1)).min(2),
        ...explained,
      }),
    )
    .min(1),
});

export const tfngGroup = z.object({
  type: z.literal("tfng"),
  ...groupBase,
  /** TRUE/FALSE/NOT GIVEN for facts, YES/NO/NOT GIVEN for the writer's views. */
  variant: z.enum(["tfng", "ynng"]),
  questions: z
    .array(
      z.object({
        n: z.number().int().positive(),
        statement: z.string().min(1),
        answer: z.enum(["TRUE", "FALSE", "YES", "NO", "NOT GIVEN"]),
        ...explained,
      }),
    )
    .min(1),
});

/** Headings, information, features, sentence endings, map/diagram letters. */
export const matchingGroup = z.object({
  type: z.literal("matching"),
  ...groupBase,
  options: z.array(option).min(2),
  /** Whether one option may be used for more than one question ("NB You may use any letter more than once"). */
  allowReuse: z.boolean().default(false),
  questions: z
    .array(
      z.object({
        n: z.number().int().positive(),
        prompt: z.string().min(1),
        answer: z.string().min(1),
        ...explained,
      }),
    )
    .min(1),
});

/**
 * Gap-fill of any kind: sentence, summary, note, table, form, flow-chart, short answer,
 * diagram labels. With `template`, blanks are written `{{n}}` inside a markdown block
 * (notes, forms, tables); without it, each question's `prompt` holds its own `{{n}}`.
 * With `wordBank`, the candidate types a letter from the box instead of words.
 */
export const completionGroup = z.object({
  type: z.literal("completion"),
  ...groupBase,
  maxWords: z.number().int().min(1).max(5),
  allowNumber: z.boolean().default(true),
  template: z.string().optional(),
  wordBank: z.array(option).optional(),
  questions: z
    .array(
      z.object({
        n: z.number().int().positive(),
        prompt: z.string().optional(),
        /** Every accepted spelling/variant. Matching is case-insensitive. */
        answers: z.array(z.string().min(1)).min(1),
        ...explained,
      }),
    )
    .min(1),
});

export const questionGroup = z.discriminatedUnion("type", [
  mcqSingleGroup,
  mcqMultiGroup,
  tfngGroup,
  matchingGroup,
  completionGroup,
]);

export const passage = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  paragraphs: z.array(z.object({ label: z.string().optional(), text: z.string().min(1) })).min(1),
});

export const scriptLine = z.object({
  speaker: z.string().min(1),
  voice: z.enum(["female", "male"]),
  /** en-GB, en-AU, en-US… used to pick a TTS voice; the test uses a mix of accents. */
  accent: z.enum(["en-GB", "en-AU", "en-US", "en-CA", "en-NZ", "en-IE"]).default("en-GB"),
  text: z.string().min(1),
});

export const audio = z.object({
  /** Optional recorded file under content/assets; otherwise the script is read by TTS. */
  src: z.string().optional(),
  script: z.array(scriptLine).min(1),
});

export const questionSet = z
  .object({
    id: slug,
    kind: z.literal("question_set"),
    skill: z.enum(["reading", "listening", "grammar"]),
    module: examModule,
    title: z.string().min(1),
    /** Listening section 1–4 or reading passage 1–3, as placed in a full test. */
    part: z.number().int().min(1).max(4).optional(),
    difficulty,
    /** Recommended minutes; practice mode shows it as a soft timer. */
    minutes: z.number().int().positive(),
    tags: z.array(z.string()).default([]),
    /** Hidden from the practice library — used only inside mock tests or placement. */
    unlisted: z.boolean().default(false),
    passage: passage.optional(),
    audio: audio.optional(),
    groups: z.array(questionGroup).min(1),
  })
  .superRefine((set, ctx) => {
    if (set.skill === "reading" && !set.passage) {
      ctx.addIssue({ code: "custom", message: "reading sets need a passage" });
    }
    if (set.skill === "listening" && !set.audio) {
      ctx.addIssue({ code: "custom", message: "listening sets need audio.script" });
    }
  });

const chartSeries = z.object({ name: z.string(), values: z.array(z.number()) });

/** Data the app renders as a chart, so Task 1 needs no image files. */
export const chartSpec = z.object({
  type: z.enum(["line", "bar", "pie", "table"]),
  title: z.string(),
  unit: z.string().optional(),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  categories: z.array(z.string()).min(1),
  series: z.array(chartSeries).min(1),
});

const sampleAnswer = z.object({
  band: z.number().min(4).max(9),
  text: z.string().min(1),
  commentary: z.string().min(1),
});

export const writingTask = z.object({
  id: slug,
  kind: z.literal("writing_task"),
  module: examModule,
  task: z.union([z.literal(1), z.literal(2)]),
  taskType: z.enum([
    "line_graph",
    "bar_chart",
    "pie_chart",
    "table",
    "mixed_charts",
    "process",
    "map",
    "letter_formal",
    "letter_semi_formal",
    "letter_informal",
    "opinion",
    "discussion",
    "problem_solution",
    "advantages_disadvantages",
    "two_part",
  ]),
  title: z.string().min(1),
  difficulty,
  unlisted: z.boolean().default(false),
  prompt: z.string().min(1),
  charts: z.array(chartSpec).optional(),
  /** Process or map stages as text, rendered as a flow when there is no image. */
  steps: z.array(z.string()).optional(),
  image: z.string().optional(),
  minWords: z.number().int().positive(),
  minutes: z.number().int().positive(),
  tips: z.array(z.string()).default([]),
  samples: z.array(sampleAnswer).default([]),
});

export const speakingTask = z.object({
  id: slug,
  kind: z.literal("speaking_task"),
  part: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  topic: z.string().min(1),
  difficulty,
  unlisted: z.boolean().default(false),
  /** Parts 1 and 3: the examiner's questions. Part 2: optional rounding-off questions. */
  questions: z.array(z.string()).default([]),
  cueCard: z
    .object({ prompt: z.string(), bullets: z.array(z.string()).min(2), closing: z.string() })
    .optional(),
  tips: z.array(z.string()).default([]),
  usefulPhrases: z.array(z.string()).default([]),
  samples: z.array(sampleAnswer).default([]),
});

export const mockTest = z.object({
  id: slug,
  kind: z.literal("mock_test"),
  module: z.enum(["academic", "general"]),
  title: z.string().min(1),
  description: z.string().default(""),
  listening: z.array(slug).length(4),
  reading: z.array(slug).length(3),
  writing: z.tuple([slug, slug]),
  speaking: z.tuple([slug, slug, slug]),
});

export const vocabWord = z.object({
  id: slug,
  word: z.string().min(1),
  pos: z.string().min(1),
  level: z.enum(["B1", "B2", "C1", "C2"]),
  definition: z.string().min(1),
  /** Short Indonesian gloss for learners. */
  translation: z.string().optional(),
  example: z.string().min(1),
  collocations: z.array(z.string()).default([]),
  synonyms: z.array(z.string()).default([]),
});

export const vocabDeck = z.object({
  id: slug,
  kind: z.literal("vocab_deck"),
  title: z.string().min(1),
  theme: z.string().min(1),
  description: z.string().default(""),
  words: z.array(vocabWord).min(5),
});

export const quizItem = z.object({
  prompt: z.string().min(1),
  options: z.array(z.string()).min(2),
  /** Index into options. */
  answer: z.number().int().min(0),
  explanation: z.string().optional(),
});

/** Lessons are markdown files; this validates their front matter. */
export const lessonMeta = z.object({
  id: slug,
  title: z.string().min(1),
  skill: z.enum(["listening", "reading", "writing", "speaking", "grammar", "vocabulary", "general"]),
  order: z.number().int(),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  minutes: z.number().int().positive(),
  summary: z.string().min(1),
  /** Practice categories this lesson teaches, so the study plan can recommend it. */
  categories: z.array(questionCategory).default([]),
  quiz: z.array(quizItem).default([]),
});

export type ExamModule = z.infer<typeof examModule>;
export type QuestionCategory = z.infer<typeof questionCategory>;
export type QuestionGroup = z.infer<typeof questionGroup>;
export type QuestionSet = z.infer<typeof questionSet>;
export type WritingTask = z.infer<typeof writingTask>;
export type SpeakingTask = z.infer<typeof speakingTask>;
export type MockTest = z.infer<typeof mockTest>;
export type VocabDeck = z.infer<typeof vocabDeck>;
export type VocabWord = z.infer<typeof vocabWord>;
export type LessonMeta = z.infer<typeof lessonMeta>;
export type Lesson = LessonMeta & { body: string };
export type ChartSpec = z.infer<typeof chartSpec>;
