import type { SpeakingTask, WritingTask } from "@/lib/content/schema";

/**
 * Prompts for AI assessment. The descriptors below are BandUp's own condensed paraphrase
 * of the public IELTS band descriptors — enough to anchor a model's judgement without
 * reproducing the official text.
 */

const WRITING_DESCRIPTORS = `
Assess on four criteria, each 0–9 in half bands:
- TA (Task 1: Task Achievement / Task 2: Task Response): Task 1 — clear overview, key features selected and compared, accurate data, appropriate format/tone for letters. Task 2 — all parts of the question addressed, clear position throughout, ideas extended and supported. Under-length answers are penalised.
- CC (Coherence & Cohesion): logical progression, paragraphing, a range of cohesive devices used naturally (not mechanically), clear referencing.
- LR (Lexical Resource): range and precision of vocabulary, collocation, less common items, spelling and word formation errors and how much they impede communication.
- GRA (Grammatical Range & Accuracy): range of complex structures, proportion of error-free sentences, punctuation, how errors affect meaning.
Anchors: 9 = expert, virtually no errors; 8 = very good, occasional slips; 7 = good, frequent error-free sentences, some less common vocabulary; 6 = competent, mix of simple and complex forms, errors rarely impede meaning; 5 = modest, limited range, frequent errors; 4 = limited.
Be calibrated and honest: do not inflate scores. Most learner essays fall between 5 and 7.`;

const SPEAKING_DESCRIPTORS = `
Assess on four criteria, each 0–9 in half bands:
- FC (Fluency & Coherence): ability to speak at length, hesitation and self-correction, logical sequencing, use of discourse markers.
- LR (Lexical Resource): range, idiomatic and less common vocabulary, paraphrase, precision.
- GRA (Grammatical Range & Accuracy): range of structures, frequency of error-free sentences.
- P (Pronunciation): you only have a transcript, so estimate P conservatively from evidence such as chunking, transcription errors that suggest mispronounced words, and fillers. Never rate P more than one band above the mean of the other three, and say in the feedback that P is an estimate.
Anchors: 9 = expert; 8 = very good; 7 = good, speaks at length without noticeable effort; 6 = competent, willing to speak at length but with some loss of coherence; 5 = modest, relies on repetition and slow speech; 4 = limited.
Be calibrated and honest. Short or off-topic answers score lower on FC.`;

const JSON_SHAPE_WRITING = `{"criteria":{"ta":6.5,"cc":6,"lr":6.5,"gra":6},"summary":"two or three sentences","strengths":["..."],"improvements":["specific, actionable advice"],"corrections":[{"original":"exact phrase from the answer","suggestion":"improved version","note":"why"}]}`;
const JSON_SHAPE_SPEAKING = `{"criteria":{"fc":6.5,"lr":6,"gra":6,"p":6},"summary":"two or three sentences","strengths":["..."],"improvements":["specific, actionable advice"],"corrections":[{"original":"exact phrase from the transcript","suggestion":"improved version","note":"why"}]}`;

export interface Prompt {
  system: string;
  user: string;
}

export function writingPrompt(task: WritingTask, essay: string, wordCount: number): Prompt {
  const visual = [
    task.charts?.length ? `Chart data (JSON): ${JSON.stringify(task.charts)}` : "",
    task.steps?.length ? `Stages shown:\n${task.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    system: `You are an experienced IELTS Writing examiner giving feedback to a learner.\n${WRITING_DESCRIPTORS}\n\nReply with ONLY a JSON object of this shape, no prose and no code fences:\n${JSON_SHAPE_WRITING}\nGive 2–4 strengths, 3–5 improvements and up to 8 corrections quoting the learner's exact words.`,
    user: [
      `Module: ${task.module === "general" ? "General Training" : "Academic"}. Writing Task ${task.task} (${task.taskType}). Minimum ${task.minWords} words.`,
      `Task:\n${task.prompt}`,
      visual,
      `Learner's answer (${wordCount} words):\n"""\n${essay}\n"""`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  };
}

export function speakingPrompt(task: SpeakingTask, transcript: string, durationSec: number): Prompt {
  const questions = task.cueCard
    ? `Cue card: ${task.cueCard.prompt}\nYou should say:\n${task.cueCard.bullets.map((b) => `- ${b}`).join("\n")}\n${task.cueCard.closing}`
    : `Examiner questions:\n${task.questions.map((q) => `- ${q}`).join("\n")}`;

  return {
    system: `You are an experienced IELTS Speaking examiner giving feedback to a learner.\n${SPEAKING_DESCRIPTORS}\n\nReply with ONLY a JSON object of this shape, no prose and no code fences:\n${JSON_SHAPE_SPEAKING}\nGive 2–4 strengths, 3–5 improvements and up to 8 corrections quoting the learner's exact words.`,
    user: [
      `Speaking Part ${task.part}: ${task.topic}.`,
      questions,
      `Recording length: ${Math.round(durationSec)} seconds.`,
      `Transcript of the learner's answer:\n"""\n${transcript}\n"""`,
    ].join("\n\n"),
  };
}
