/**
 * Learner-facing summaries of what each band looks like per criterion, written for
 * self-assessment. A condensed paraphrase of the public descriptors, not the official text.
 */

export interface CriterionGuide {
  key: string;
  bands: Record<"5" | "6" | "7" | "8", string>;
}

export const WRITING_RUBRIC: CriterionGuide[] = [
  {
    key: "ta",
    bands: {
      "5": "Addresses the task only partly; format may be wrong; ideas or key features limited and not well developed.",
      "6": "Addresses all parts, but some more fully than others; relevant position or overview, though conclusions may be unclear or repetitive.",
      "7": "Addresses all parts; clear position or overview; main ideas extended and supported, though some may over-generalise.",
      "8": "Sufficiently addresses all parts; well-developed response with relevant, extended and supported ideas; clear overview of key features.",
    },
  },
  {
    key: "cc",
    bands: {
      "5": "Some organisation but lacks overall progression; linking is inadequate, inaccurate or overused; paragraphing may be missing.",
      "6": "Arranges ideas coherently with clear overall progression; cohesive devices used effectively but sometimes mechanically.",
      "7": "Logically organised with clear progression; a range of cohesive devices used appropriately, with some under- or over-use.",
      "8": "Sequences information and ideas logically; manages all aspects of cohesion well; paragraphing is sufficient and appropriate.",
    },
  },
  {
    key: "lr",
    bands: {
      "5": "Limited range, minimally adequate; noticeable spelling or word-formation errors that may cause difficulty for the reader.",
      "6": "Adequate range for the task; attempts less common vocabulary with some inaccuracy; errors do not impede communication.",
      "7": "Sufficient range for flexibility and precision; uses less common items with awareness of style and collocation; occasional errors.",
      "8": "Wide range used fluently and flexibly to convey precise meanings; skilful use of uncommon items with only rare slips.",
    },
  },
  {
    key: "gra",
    bands: {
      "5": "Limited range of structures; complex sentences attempted but less accurate; frequent errors that can cause difficulty.",
      "6": "Mix of simple and complex sentence forms; some errors in grammar and punctuation, but they rarely reduce communication.",
      "7": "Variety of complex structures; frequent error-free sentences; good control, though a few errors persist.",
      "8": "Wide range of structures; the majority of sentences are error-free; only very occasional errors or inappropriacies.",
    },
  },
];

export const SPEAKING_RUBRIC: CriterionGuide[] = [
  {
    key: "fc",
    bands: {
      "5": "Usually keeps going but relies on repetition, self-correction or slow speech; overuses certain connectives.",
      "6": "Willing to speak at length, though may lose coherence at times through hesitation or repetition; uses a range of connectives.",
      "7": "Speaks at length without noticeable effort or loss of coherence; some language-related hesitation; flexible discourse markers.",
      "8": "Speaks fluently with only occasional repetition or self-correction; develops topics coherently and appropriately.",
    },
  },
  {
    key: "lr",
    bands: {
      "5": "Manages familiar and unfamiliar topics with limited flexibility; attempts paraphrase with mixed success.",
      "6": "Wide enough vocabulary to discuss topics at length; meaning is clear despite some inappropriacies; paraphrases generally well.",
      "7": "Uses vocabulary flexibly; some less common and idiomatic items with awareness of style and collocation.",
      "8": "Wide resource used readily and flexibly for precise meaning; uses idiomatic language skilfully, with occasional inaccuracies.",
    },
  },
  {
    key: "gra",
    bands: {
      "5": "Basic sentence forms with reasonable accuracy; limited complex structures, usually with errors.",
      "6": "Mix of simple and complex structures with limited flexibility; frequent errors in complex structures, rarely affecting meaning.",
      "7": "A range of complex structures with some flexibility; frequently error-free sentences, with some errors persisting.",
      "8": "Wide range of structures, flexibly used; the majority of sentences are error-free; occasional inappropriacies.",
    },
  },
  {
    key: "p",
    bands: {
      "5": "Some features of band 6 but not all; mispronunciations are frequent enough to cause some difficulty.",
      "6": "Range of features with mixed control; generally understood, though mispronunciation of words or sounds reduces clarity at times.",
      "7": "Most features of band 8; easy to understand throughout; L1 accent has minimal effect.",
      "8": "Wide range of features; sustained flexible use; easy to understand throughout with only occasional lapses.",
    },
  },
];
