# BandUp

**Open-source IELTS preparation**: lessons, practice for every question type, full mock
tests, spaced-repetition vocabulary and a progress tracker that shows where your band score
stands. It covers Academic and General Training, and the interface is available in
Indonesian and English.

> BandUp is not affiliated with the British Council, IDP or Cambridge. All material is
> original and written in the format of the test.

## Features

| Module | What it does |
|---|---|
| **Onboarding & placement** | You choose a test type, target band, exam date and study days, then take a 15-minute placement test that estimates your starting band. |
| **Learn** | 30 strategy and grammar lessons, each with a quick check, progress per skill and an "up next" suggestion. |
| **Vocabulary** | 10 topic decks with 300 words, reviewed with SM-2 spaced repetition. Grade buttons show when each card will come back, words have Indonesian glosses and text-to-speech, and there is a search across all words and meanings. |
| **Practice** | Reading, Listening and Grammar sets covering every task type, plus Writing Task 1/2 and Speaking Part 1–3. Filter by skill, question type and status, and sort by a recommendation that favours your weak spots. |
| **Exam experience** | A focus mode modelled on the computer-delivered test: highlights and notes on the passage, flag-for-review, a question palette, shortcuts, a resizable split view and display settings (size, contrast, font). Listening sections give preview time and play once. Speaking is run by an examiner who reads each question aloud. |
| **Mock tests** | Full timed tests (2 Academic, 1 General Training) in exam order, with autosave and resume. Sections close themselves when time runs out. |
| **Mistake notebook** | Every answered question you get wrong is saved with its explanation. You drill it until you answer it correctly twice in a row, can retry the wrong answers straight from any result, and can bookmark questions and lessons. |
| **Writing & Speaking coach** | An essay planner, a live analysis panel (paragraphs, sentence length, linking words, repetition, a task checklist) and a phrase bank. AI corrections appear inline in your essay. Speaking gets fluency metrics: words per minute, fillers and lexical variety. |
| **Scoring** | Listening and Reading are marked automatically, with answer normalisation and word limits, then converted to bands. Writing and Speaking are scored per criterion, either by self-assessment against rubrics or by your own AI key. Overall bands use the official rounding rules. |
| **Dashboard & progress** | A band gauge against your target, a daily-goal ring, a "next best step" card, a 16-week activity heatmap, bands over time, accuracy by question type, weekly recaps and achievements. |
| **Study plan** | A weekly plan built from your target, exam date and weak areas, ending with mock tests. You can export it to your calendar as `.ics`. |
| **App** | Installable PWA, light and dark themes, Indonesian and English. |
| **Admin** | User roles, content publishing and usage statistics. |

Listening audio is read aloud by the browser's text-to-speech from the written script, with
several accents. Recorded audio can be added per set.

## AI feedback (optional, bring your own key)

In **Settings → AI feedback**, a learner can add their own key:

- **Anthropic** (Claude), or
- **any OpenAI-compatible endpoint** (OpenAI, OpenRouter, Groq, a local Ollama…). This also
  enables Whisper transcription for Speaking.

Keys are encrypted at rest with AES-256-GCM (`APP_ENCRYPTION_KEY`) and used only for that
learner's own feedback. Without a key, everything works with self-assessment. Base URLs on
private or loopback networks are refused unless the operator sets
`AI_ALLOW_PRIVATE_BASE_URL=true`.

## Quick start (Docker)

```bash
cp .env.example .env
echo "APP_ENCRYPTION_KEY=\"$(openssl rand -base64 32)\"" >> .env
docker compose up -d
```

Then open http://localhost:3000. **The first account you register becomes the admin.**

## Development

Requirements: Node 22+, pnpm 10, PostgreSQL 16.

```bash
pnpm install
cp .env.example .env            # set DATABASE_URL and APP_ENCRYPTION_KEY
pnpm db:migrate                 # create the schema
pnpm content:sync               # load content/ into the database
pnpm dev
```

| Command | Purpose |
|---|---|
| `pnpm content:validate` | Validate every content file: schema, answer keys, numbering, mock test structure |
| `pnpm content:sync` | Upsert content into the database (unchanged items are skipped) |
| `pnpm test` / `pnpm test:coverage` | Unit tests (Vitest) |
| `pnpm e2e` | End-to-end tests (Playwright, against `pnpm build`) |
| `pnpm typecheck` / `pnpm lint` | Static checks |

### Architecture

- **Next.js 16** App Router, with Server Components and Server Actions. Tailwind CSS v4.
- **PostgreSQL + Prisma 7.** Content is authored as files and copied into `content_items`.
  Learner state (attempts, answers, scores, reviews, study logs) lives in its own tables.
- Grading runs on the server. Answer keys are stripped before a set is sent to the browser.
- Sessions are database-backed and kept in httpOnly cookies. Passwords are hashed with scrypt.
  Auth endpoints and AI calls are rate-limited.

```
app/            routes (marketing, auth, the learner app, admin, API routes)
components/     UI: question renderers, test runner, charts, assessment
lib/content/    content schema, validation, loaders
lib/scoring/    marking, band conversion, rubrics
lib/srs/        SM-2 spaced repetition
lib/plan/       study plan generator
lib/ai/         prompts, response parsing, provider clients
content/        lessons, vocab, practice, mock tests (CC BY-SA 4.0)
```

## Contributing

New questions, lessons, translations and fixes are welcome. See
[CONTRIBUTING.md](CONTRIBUTING.md) and the [Content Guide](CONTENT_GUIDE.md).

## License

- Code: [MIT](LICENSE)
- Content in `content/`: [CC BY-SA 4.0](content/LICENSE)
