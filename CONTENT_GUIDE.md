# Content Guide

BandUp's learning material lives in `content/` as plain files. The schema is in
[`lib/content/schema.ts`](lib/content/schema.ts) and extra consistency checks are in
[`lib/content/check.ts`](lib/content/check.ts). Run `pnpm content:validate` before opening a PR.
CI runs the same command.

## Ground rules

1. **Original material only.** Never copy questions, passages, audio scripts or model answers
   from Cambridge IELTS books, IDP, the British Council or any commercial course. Write your own
   in the *format* of the exam. Content is licensed CC BY-SA 4.0 (see `content/LICENSE`).
2. **Realistic difficulty.** Reading passages in a full Academic test run 700–950 words each.
   Listening scripts should read like natural speech, with fillers, corrections and distractors
   ("Tuesday — no, sorry, Wednesday").
3. **Unambiguous keys.** Every answer must be clearly supported (or, for NOT GIVEN, clearly
   absent) in the passage or script. Put the paragraph label or script cue in `evidence` and a
   one- or two-sentence `explanation`.
4. **Ids** are lowercase kebab-case and unique across all content.

## Layout

```
content/
  lessons/<skill>/*.md            # markdown + YAML front matter
  vocab/*.json                    # one deck per theme
  practice/reading/*.json         # question_set, skill "reading"
  practice/listening/*.json       # question_set, skill "listening"
  practice/grammar/*.json         # question_set, skill "grammar"
  placement/*.json                # question_set with "unlisted": true
  writing/*.json                  # writing_task
  speaking/*.json                 # speaking_task
  mock-tests/sets/*.json          # question_set used by mock tests ("unlisted": true)
  mock-tests/tests/*.json         # mock_test, which references the sets and tasks above
  assets/                         # images (SVG preferred) referenced by "image"
```

## Question sets

A set is one reading passage or one listening section. It contains one or more **groups**,
and each group is one block of instructions plus questions. Question numbers (`n`) are
consecutive across the whole set. Inside a mock test they continue across sets: Listening
1–10, 11–20, 21–30, 31–40, and Reading 1–13, 14–26, 27–40 (passage lengths may vary as long as
the total is 40).

Every group has a `type` (which renderer to use) and a `category` (the official task type,
used for analytics):

| type          | categories it is used for |
|---------------|---------------------------|
| `mcq_single`  | `multiple_choice` |
| `mcq_multi`   | `multiple_choice` (Choose TWO/THREE letters) |
| `tfng`        | `true_false_not_given` (variant `tfng`), `yes_no_not_given` (variant `ynng`) |
| `matching`    | `matching_headings`, `matching_information`, `matching_features`, `matching_sentence_endings`, `map_labelling`, `diagram_labelling` |
| `completion`  | `sentence_completion`, `summary_completion`, `note_completion`, `table_completion`, `form_completion`, `flow_chart_completion`, `diagram_labelling`, `short_answer` |

Grammar sets use `mcq_single` or `completion` with category `grammar`.

### Example: reading

```json
{
  "id": "prd-urban-bees",
  "kind": "question_set",
  "skill": "reading",
  "module": "academic",
  "title": "The Return of the Urban Bee",
  "difficulty": 2,
  "minutes": 20,
  "tags": ["environment", "science"],
  "passage": {
    "title": "The Return of the Urban Bee",
    "paragraphs": [
      { "label": "A", "text": "..." },
      { "label": "B", "text": "..." }
    ]
  },
  "groups": [
    {
      "type": "matching",
      "category": "matching_headings",
      "instructions": "Reading Passage has six paragraphs, A–F. Choose the correct heading for each paragraph from the list of headings below.",
      "options": [
        { "key": "i", "text": "An unexpected advantage of city life" },
        { "key": "ii", "text": "..." }
      ],
      "allowReuse": false,
      "questions": [
        { "n": 1, "prompt": "Paragraph A", "answer": "ii", "evidence": "A", "explanation": "..." }
      ]
    },
    {
      "type": "tfng",
      "variant": "tfng",
      "category": "true_false_not_given",
      "instructions": "Do the following statements agree with the information given in the passage? Write TRUE, FALSE or NOT GIVEN.",
      "questions": [
        { "n": 7, "statement": "...", "answer": "NOT GIVEN", "evidence": "C", "explanation": "..." }
      ]
    },
    {
      "type": "completion",
      "category": "summary_completion",
      "instructions": "Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
      "maxWords": 2,
      "allowNumber": false,
      "template": "Urban beekeepers found that colonies on rooftops produced more {{11}} than those in the countryside, largely because of the variety of {{12}} in parks and gardens.",
      "questions": [
        { "n": 11, "answers": ["honey"], "evidence": "D" },
        { "n": 12, "answers": ["flowering plants", "plants"], "evidence": "D" }
      ]
    }
  ]
}
```

### Example: listening

Listening sets carry an `audio.script` that the app reads aloud with text-to-speech, so you
do not need a recording (add `audio.src` if one exists). Give each speaker a `voice`
(`female`/`male`) and an `accent`, and mix accents across a test.

```json
{
  "id": "pls-gym-membership",
  "kind": "question_set",
  "skill": "listening",
  "module": "both",
  "part": 1,
  "title": "Joining a Sports Centre",
  "difficulty": 1,
  "minutes": 7,
  "audio": {
    "script": [
      { "speaker": "Receptionist", "voice": "female", "accent": "en-GB", "text": "Good morning, Riverside Sports Centre. How can I help?" },
      { "speaker": "Caller", "voice": "male", "accent": "en-AU", "text": "Hi, I'd like to ask about membership..." }
    ]
  },
  "groups": [
    {
      "type": "completion",
      "category": "form_completion",
      "instructions": "Complete the form below. Write ONE WORD AND/OR A NUMBER for each answer.",
      "maxWords": 1,
      "allowNumber": true,
      "template": "**Membership enquiry**\n\n- Name: Daniel {{1}}\n- Preferred start date: {{2}} March",
      "questions": [
        { "n": 1, "answers": ["Hargreaves"], "evidence": "line 6" },
        { "n": 2, "answers": ["14", "14th", "fourteenth"], "evidence": "line 9" }
      ]
    }
  ]
}
```

Rules for completion answers:
- List **every** accepted variant: `"14", "14th"`, British and American spellings, with and
  without hyphens. Matching ignores case and surrounding punctuation.
- Each variant must fit `maxWords`. `allowNumber: true` means "AND/OR A NUMBER".
- With a `template`, each blank is `{{n}}`. Without one, put `{{n}}` inside the question's own
  `prompt` (sentence completion and short answer).
- For a summary with a box of options, add a `wordBank` (`[{ "key": "A", "text": "..." }]`)
  and make the answers letters.

Map and diagram labelling use `matching` (letters on the picture) or `completion`, plus an
`image` path under `content/assets/` (an SVG with labelled letters).

## Writing tasks

```json
{
  "id": "wt-a1-commute-modes",
  "kind": "writing_task",
  "module": "academic",
  "task": 1,
  "taskType": "bar_chart",
  "title": "Commuting methods in three cities",
  "difficulty": 2,
  "prompt": "The chart below shows the percentage of workers using four methods of transport to commute in three cities in 2024.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.",
  "charts": [
    {
      "type": "bar",
      "title": "Commuting methods, 2024",
      "unit": "%",
      "yLabel": "Percentage of workers",
      "categories": ["Car", "Bus", "Rail", "Bicycle"],
      "series": [
        { "name": "Northport", "values": [52, 21, 15, 12] },
        { "name": "Lakeside", "values": [38, 30, 22, 10] }
      ]
    }
  ],
  "minWords": 150,
  "minutes": 20,
  "tips": ["Start with an overview of the biggest contrast."],
  "samples": [
    { "band": 7, "text": "...", "commentary": "..." }
  ]
}
```

- Task 1 Academic charts are drawn from `charts` (`line`, `bar`, `pie`, `table`).
  `series[i].values` has one value per category. Processes and maps use `steps` (ordered
  stages) and optionally an `image`.
- General Training Task 1 is a letter (`letter_formal`, `letter_semi_formal`, `letter_informal`)
  with bullet points written inside `prompt`.
- Task 2 is shared by both modules (`module: "both"`), `minWords: 250`, `minutes: 40`.
- Samples: aim for bands 6, 7 and 8, each with a commentary against the four criteria
  (Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range &
  Accuracy). The writing must genuinely match the band claimed. A band 6 answer has real band 6
  weaknesses.

## Speaking tasks

```json
{
  "id": "sp-p2-memorable-journey",
  "kind": "speaking_task",
  "part": 2,
  "topic": "A memorable journey",
  "difficulty": 2,
  "cueCard": {
    "prompt": "Describe a journey you remember well.",
    "bullets": ["where you went", "who you went with", "how you travelled"],
    "closing": "and explain why you remember this journey so well."
  },
  "questions": ["Do you usually plan journeys carefully?"],
  "tips": ["Use the minute of preparation to note one word per bullet."],
  "usefulPhrases": ["What really stuck with me was..."],
  "samples": [{ "band": 7, "text": "...", "commentary": "..." }]
}
```

Part 1 and Part 3 put the examiner's questions in `questions` (4–6 for Part 1, 4–6 for
Part 3) and leave out `cueCard`.

## Mock tests

```json
{
  "id": "mock-academic-1",
  "kind": "mock_test",
  "module": "academic",
  "title": "Academic Mock Test 1",
  "description": "...",
  "listening": ["m1-l1", "m1-l2", "m1-l3", "m1-l4"],
  "reading": ["m1-r1", "m1-r2", "m1-r3"],
  "writing": ["m1-w1", "m1-w2"],
  "speaking": ["m1-s1", "m1-s2", "m1-s3"]
}
```

Sets and tasks that only exist for a mock test should have `"unlisted": true` so they stay out
of the practice library until the test has been taken. The validator checks that each section
has exactly 40 questions numbered 1–40, that `part` matches the position, and that modules agree.

Typical structure:
- **Listening.** Part 1 is an everyday conversation (form/note completion). Part 2 is an everyday
  monologue (MCQ, map labelling). Part 3 is an academic discussion between 2–3 speakers (MCQ,
  matching). Part 4 is an academic lecture (note/sentence completion).
- **Reading (Academic).** Three long passages of rising difficulty from journals, books and
  magazines.
- **Reading (General Training).** Section 1 has two or three short everyday texts. Section 2 has
  two work-related texts. Section 3 has one long general-interest text. In content, a section's
  separate texts go in one passage with labelled paragraphs, or in one set per section with
  subtitles.

## Lessons

Markdown with YAML front matter, under `content/lessons/<skill>/`:

```markdown
---
id: reading-tfng-strategy
title: "True / False / Not Given: a reliable method"
skill: reading
order: 3
level: intermediate
minutes: 12
summary: Tell FALSE from NOT GIVEN by testing each statement against the passage.
categories: [true_false_not_given, yes_no_not_given]
quiz:
  - prompt: "The passage says nothing about cost. The statement says it was expensive. Answer?"
    options: ["TRUE", "FALSE", "NOT GIVEN"]
    answer: 2
    explanation: "No information either way, so the answer is NOT GIVEN."
---

## Why this question type is hard
...
```

Write the body in clear English for learners at around B1–B2 level. Use worked examples,
common traps, and a short step-by-step method. Add 3–5 quiz items.

## Vocabulary decks

```json
{
  "id": "vocab-environment",
  "kind": "vocab_deck",
  "title": "Environment",
  "theme": "environment",
  "description": "Words for Task 2 essays and Speaking Part 3 on climate and nature.",
  "words": [
    {
      "id": "env-mitigate",
      "word": "mitigate",
      "pos": "verb",
      "level": "C1",
      "definition": "to make something bad less severe",
      "translation": "mengurangi dampak",
      "example": "Planting trees along roads can help mitigate air pollution.",
      "collocations": ["mitigate the effects", "mitigate risk"],
      "synonyms": ["alleviate", "lessen"]
    }
  ]
}
```

Word ids must be unique across all decks. Prefix them with the deck theme.
