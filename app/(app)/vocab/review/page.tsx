import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { listContent } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { VocabWord } from "@/lib/content/schema";
import { Flashcards, type FlashcardItem, type FlashcardLabels } from "./flashcards";

export const metadata: Metadata = { title: "Vocabulary review" };

/** New words per session; more than this and the reviews they spawn tomorrow pile up. */
const NEW_PER_SESSION = 10;
/** Keeps one sitting to a manageable length; the rest stay due for the next one. */
const MAX_DUE = 100;

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function VocabReviewPage({ searchParams }: PageProps<"/vocab/review">) {
  const query = await searchParams;
  const user = await requireLearner();
  const { t } = await getDictionary();

  const decks = await listContent("vocab_deck");
  const deckParam = first(query.deck);
  const deck = deckParam ? decks.find((d) => d.id === deckParam) : undefined;
  const wantNew = first(query.new) === "1";

  const words = new Map(
    decks.flatMap((d) => d.payload.words.map((w): [string, { deckId: string; word: VocabWord }] => [w.id, { deckId: d.id, word: w }])),
  );

  const due = await db.vocabReview.findMany({
    where: { userId: user.id, due: { lte: new Date() }, ...(deck ? { deckId: deck.id } : {}) },
    orderBy: { due: "asc" },
    take: MAX_DUE,
    select: { wordId: true, ease: true, interval: true, reps: true, lapses: true },
  });
  const dueItems = due.flatMap((r) => {
    const hit = words.get(r.wordId);
    return hit ? [{ ...toItem(hit.deckId, hit.word), srs: { ease: r.ease, interval: r.interval, reps: r.reps, lapses: r.lapses } }] : [];
  });

  const newItems = wantNew && deck ? await unseenWords(user.id, deck.id, deck.payload.words) : [];
  const queue = [...dueItems, ...newItems];
  const title = deck ? deck.payload.title : t.vocab.allDecks;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/vocab" className="text-sm text-muted hover:text-fg">
        ← {t.vocab.backToDecks}
      </Link>
      <div className="mt-3">
        <PageHeader title={`${t.vocab.title} · ${title}`} sub={t.vocab.hint} />
      </div>
      {queue.length === 0 ? (
        <AllCaughtUp deckId={deck?.id} t={t} />
      ) : (
        <Flashcards items={queue} labels={flashcardLabels(t)} doneSlot={<AllCaughtUp deckId={deck?.id} t={t} />} />
      )}
    </div>
  );
}

async function unseenWords(userId: string, deckId: string, deckWords: VocabWord[]): Promise<FlashcardItem[]> {
  const seen = await db.vocabReview.findMany({
    where: { userId, wordId: { in: deckWords.map((w) => w.id) } },
    select: { wordId: true },
  });
  const seenIds = new Set(seen.map((s) => s.wordId));
  return deckWords
    .filter((w) => !seenIds.has(w.id))
    .slice(0, NEW_PER_SESSION)
    .map((w) => toItem(deckId, w));
}

function toItem(deckId: string, w: VocabWord): FlashcardItem {
  return {
    deckId,
    wordId: w.id,
    word: w.word,
    pos: w.pos,
    level: w.level,
    definition: w.definition,
    translation: w.translation ?? null,
    example: w.example,
    collocations: w.collocations,
    synonyms: w.synonyms,
  };
}

function AllCaughtUp({ deckId, t }: { deckId?: string; t: Dictionary }) {
  return (
    <EmptyState
      illustration="trophy"
      title={t.vocab.done}
      action={
      <div className="flex flex-wrap justify-center gap-2">
        {deckId && (
          <LinkButton href={`/vocab/review?deck=${encodeURIComponent(deckId)}&new=1`} size="sm">
            {t.vocab.learnMore}
          </LinkButton>
        )}
        <LinkButton href="/vocab" variant="secondary" size="sm">
          {t.vocab.backToDecks}
        </LinkButton>
      </div>
      }
    />
  );
}

function flashcardLabels(t: Dictionary): FlashcardLabels {
  return {
    show: t.vocab.show,
    grades: t.vocab.grades,
    listen: t.vocab.listen,
    translation: t.vocab.translation,
    example: t.vocab.example,
    collocations: t.vocab.collocations,
    synonyms: t.vocab.synonyms,
    remaining: t.vocab.remaining,
    error: t.common.error,
  };
}
