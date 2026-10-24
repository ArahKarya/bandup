import type { Metadata } from "next";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { listContent } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { isMature } from "@/lib/srs/sm2";
import { Card, Empty, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export const metadata: Metadata = { title: "Vocabulary" };

interface DeckStats {
  id: string;
  title: string;
  theme: string;
  description: string;
  words: number;
  learned: number;
  due: number;
}

export default async function VocabPage() {
  const user = await requireLearner();
  const { t } = await getDictionary();
  const now = new Date();

  const [decks, reviews] = await Promise.all([
    listContent("vocab_deck"),
    db.vocabReview.findMany({ where: { userId: user.id }, select: { wordId: true, interval: true, due: true } }),
  ]);
  const byWord = new Map(reviews.map((r) => [r.wordId, r]));

  // Counted against the deck's current word list, so reviews of words since removed are ignored.
  const stats = decks.map((d): DeckStats => {
    const seen = d.payload.words.flatMap((w) => {
      const r = byWord.get(w.id);
      return r ? [r] : [];
    });
    return {
      id: d.id,
      title: d.payload.title,
      theme: d.payload.theme,
      description: d.payload.description,
      words: d.payload.words.length,
      learned: seen.filter((r) => isMature(r)).length,
      due: seen.filter((r) => r.due <= now).length,
    };
  });

  const totals = stats.reduce(
    (acc, s) => ({ words: acc.words + s.words, learned: acc.learned + s.learned, due: acc.due + s.due }),
    { words: 0, learned: 0, due: 0 },
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.vocab.title}
        sub={t.vocab.sub}
        actions={
          <LinkButton href="/vocab/review" variant={totals.due > 0 ? "primary" : "secondary"}>
            {t.vocab.review} ({totals.due})
          </LinkButton>
        }
      />
      {stats.length === 0 ? (
        <Empty>{t.vocab.empty}</Empty>
      ) : (
        <>
          <Totals words={totals.words} learned={totals.learned} due={totals.due} t={t} />
          <h2 className="mt-8 mb-3 text-lg font-semibold">{t.vocab.decks}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((s) => (
              <li key={s.id}>
                <DeckCard deck={s} t={t} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Totals({ words, learned, due, t }: { words: number; learned: number; due: number; t: Dictionary }) {
  const items = [
    { label: t.vocab.totalWords, value: words },
    { label: t.vocab.totalLearned, value: learned },
    { label: t.vocab.totalDue, value: due },
  ];
  return (
    <dl className="grid grid-cols-3 gap-3">
      {items.map((i) => (
        <Card key={i.label} className="p-4">
          <dt className="text-sm text-muted">{i.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{i.value}</dd>
        </Card>
      ))}
    </dl>
  );
}

function DeckCard({ deck, t }: { deck: DeckStats; t: Dictionary }) {
  const params = new URLSearchParams({ deck: deck.id });
  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">{deck.theme}</p>
        <h3 className="mt-0.5 font-medium">{deck.title}</h3>
        {deck.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{deck.description}</p>}
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <ProgressBar value={deck.learned} max={deck.words} />
        <p className="text-sm text-muted tabular-nums">
          {deck.words} {t.vocab.words} · {deck.learned} {t.vocab.learned} · {deck.due} {t.vocab.dueNow}
        </p>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/vocab/review?${params.toString()}&new=1`} size="sm">
            {t.vocab.learnNew}
          </LinkButton>
          {deck.due > 0 && (
            <LinkButton href={`/vocab/review?${params.toString()}`} variant="secondary" size="sm">
              {t.vocab.review} ({deck.due})
            </LinkButton>
          )}
        </div>
      </div>
    </Card>
  );
}
