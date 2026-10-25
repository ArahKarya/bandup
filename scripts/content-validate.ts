import { loadContent } from "../lib/content/load";

/** `pnpm content:validate` — exits non-zero when any content file is invalid. */
async function main(): Promise<void> {
  const { bundle, errors } = await loadContent();

  const counts = {
    lessons: bundle.lessons.length,
    vocabDecks: bundle.decks.length,
    vocabWords: bundle.decks.reduce((n, d) => n + d.words.length, 0),
    questionSets: bundle.sets.length,
    writingTasks: bundle.writing.length,
    speakingTasks: bundle.speaking.length,
    mockTests: bundle.mocks.length,
  };
  process.stdout.write(`${JSON.stringify(counts, null, 2)}\n`);

  if (errors.length > 0) {
    process.stderr.write(`\n${errors.length} problem(s):\n${errors.map((e) => `  - ${e}`).join("\n")}\n`);
    process.exit(1);
  }
  process.stdout.write("All content is valid.\n");
}

main().catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack : String(e)}\n`);
  process.exit(1);
});
