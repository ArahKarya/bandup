# Contributing to BandUp

Thanks for helping learners prepare for IELTS!

## Ways to help

- **Content.** Write question sets, lessons, vocabulary decks and sample answers. Read the
  [Content Guide](CONTENT_GUIDE.md) first. Everything must be original; never copy from
  published IELTS books or websites.
- **Translations.** UI strings are in `lib/i18n/dictionaries.ts`. Copy the `en` object for a
  new language.
- **Code.** Bug fixes, accessibility, performance, new features. Please open an issue first
  for anything large.

## Workflow

1. Fork and create a branch: `feat/…`, `fix/…`, `content/…`.
2. Make your change, then run:
   ```bash
   pnpm content:validate && pnpm typecheck && pnpm lint && pnpm test
   ```
3. Use conventional commit messages (`feat: …`, `fix: …`, `content: …`, `docs: …`).
4. Open a pull request that describes what changed and how you tested it.

## Code guidelines

- TypeScript strict, with no `any`. Validate input with Zod at every boundary (server
  actions, route handlers, content).
- Keep grading on the server. Never send answer keys to the browser before submission.
- Keep components and files small and focused. Prefer immutable updates.
- Use 4px corners and the design tokens in `app/globals.css`. Don't use pill-shaped controls.
- Add unit tests for logic in `lib/`. Coverage there should stay at 80% or above.

## Reviewing content

When you review a content PR, check that:

- the answer to every question is clearly supported, or clearly absent for NOT GIVEN;
- word limits and accepted variants make sense;
- sample answers genuinely match the band they claim.
