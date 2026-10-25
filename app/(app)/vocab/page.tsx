import { createElement } from "react";
import type { Metadata } from "next";
import {
  BookA,
  Briefcase,
  Building2,
  Cpu,
  FlaskConical,
  GraduationCap,
  HeartPulse,
  Landmark,
  Leaf,
  LibraryBig,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";
import { listContent } from "@/lib/server/content";
import { db } from "@/lib/server/db";
import { isMature } from "@/lib/srs/sm2";
import type { VocabWord } from "@/lib/content/schema";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Stat, inputClass } from "@/components/ui";

export const metadata: Metadata = { title: "Vocabulary" };

const THEME_ICONS: [RegExp, LucideIcon][] = [
  [/environment/, Leaf],
  [/education/, GraduationCap],
  [/technology/, Cpu],
  [/health/, HeartPulse],
  [/work|business/, Briefcase],
  [/society|culture/, Users],
  [/government|law/, Landmark],
  [/urban|transport/, Building2],
  [/science|research/, FlaskConical],
  [/data|trend/, TrendingUp],
];
const themeIcon = (theme: string): LucideIcon => THEME_ICONS.find(([re]) => re.test(theme))?.[1] ?? BookA;

interface DeckStats {
  id: string;
  title: string;
  theme: string;
  description: string;
  words: number;
  learning: number;
  learned: number;
  due: number;
}

export default async function VocabPage({ searchParams }: PageProps<"/vocab">) {
  const user = await requireLearner();
  const { t } = await getDictionary();
  const now = new Date();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";

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
    const learned = seen.filter((r) => isMature(r)).length;
    return {
      id: d.id,
      title: d.payload.title,
      theme: d.payload.theme,
      description: d.payload.description,
      words: d.payload.words.length,
      learning: seen.length - learned,
      learned,
      due: seen.filter((r) => r.due <= now).length,
    };
  });

  const totals = stats.reduce(
    (acc, s) => ({ words: acc.words + s.words, learning: acc.learning + s.learning, learned: acc.learned + s.learned, due: acc.due + s.due }),
    { words: 0, learning: 0, learned: 0, due: 0 },
  );

  const needle = q.toLowerCase();
  const matches: (VocabWord & { deck: string })[] = needle
    ? decks
        .flatMap((d) => d.payload.words.map((w) => ({ ...w, deck: d.payload.title })))
        .filter((w) => [w.word, w.definition, w.translation ?? "", ...w.synonyms].some((f) => f.toLowerCase().includes(needle)))
        .slice(0, 30)
    : [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t.vocab.title}
        sub={t.vocab.sub}
        icon={<LibraryBig size={20} aria-hidden="true" />}
        actions={
          <LinkButton href="/vocab/review" variant={totals.due > 0 ? "primary" : "secondary"}>
            <Sparkles size={16} aria-hidden="true" />
            {t.vocab.reviewAll} ({totals.due})
          </LinkButton>
        }
      />
      {stats.length === 0 ? (
        <EmptyState illustration="books" title={t.vocab.empty} />
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t.vocab.totalWords} value={totals.words} />
            <Stat label={t.vocab.stageLearning} value={totals.learning} />
            <Stat label={t.vocab.totalLearned} value={totals.learned} />
            <Stat label={t.vocab.totalDue} value={totals.due} />
          </div>

          <form role="search" className="relative" action="/vocab">
            <label htmlFor="vocab-q" className="sr-only">
              {t.vocab.search}
            </label>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input id="vocab-q" name="q" defaultValue={q} placeholder={t.vocab.searchPlaceholder} className={`${inputClass} h-11 pl-9`} />
          </form>

          {q && <SearchResults q={q} matches={matches} t={t} />}

          <section>
            <h2 className="mb-3 text-lg font-semibold">{t.vocab.decks}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stats.map((s) => (
                <li key={s.id}>
                  <DeckCard deck={s} t={t} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function SearchResults({ q, matches, t }: { q: string; matches: (VocabWord & { deck: string })[]; t: Dictionary }) {
  if (matches.length === 0) return <p className="text-sm text-muted">{fmt(t.vocab.noResults, { q })}</p>;
  return (
    <section aria-live="polite">
      <p className="mb-3 text-sm text-muted">{fmt(t.vocab.searchResults, { n: matches.length, q })}</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {matches.map((w) => (
          <li key={w.id}>
            <Card className="flex h-full flex-col gap-1.5 p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-lg font-semibold">{w.word}</p>
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <em>{w.pos}</em>
                  <Badge tone="accent">{w.level}</Badge>
                </span>
              </div>
              <p className="text-sm">{w.definition}</p>
              {w.translation && <p className="text-sm text-muted">🇮🇩 {w.translation}</p>}
              <p className="text-sm text-muted italic">“{w.example}”</p>
              <p className="mt-auto pt-1 text-xs text-muted">{w.deck}</p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DeckCard({ deck, t }: { deck: DeckStats; t: Dictionary }) {
  const params = new URLSearchParams({ deck: deck.id });
  const newCount = deck.words - deck.learning - deck.learned;
  const segments = [
    { n: deck.learned, cls: "bg-success", label: t.vocab.stageLearned },
    { n: deck.learning, cls: "bg-accent", label: t.vocab.stageLearning },
    { n: newCount, cls: "bg-surface-2", label: t.vocab.stageNew },
  ];
  return (
    <Card className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-accent-soft text-accent">
          {createElement(themeIcon(deck.theme), { size: 20, "aria-hidden": true })}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold">{deck.title}</h3>
          {deck.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{deck.description}</p>}
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex h-2 overflow-hidden rounded-sm bg-surface-2" role="img" aria-label={segments.map((s) => `${s.label}: ${s.n}`).join(", ")}>
          {segments.map((s) => (s.n > 0 ? <div key={s.label} className={s.cls} style={{ width: `${(s.n / deck.words) * 100}%` }} /> : null))}
        </div>
        <p className="flex flex-wrap gap-x-3 text-xs text-muted tabular-nums">
          <span>
            <span className="text-success">●</span> {deck.learned} {t.vocab.stageLearned.toLowerCase()}
          </span>
          <span>
            <span className="text-accent">●</span> {deck.learning} {t.vocab.stageLearning.toLowerCase()}
          </span>
          <span>
            {newCount} {t.vocab.stageNew.toLowerCase()}
          </span>
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {newCount > 0 && (
            <LinkButton href={`/vocab/review?${params.toString()}&new=1`} size="sm">
              {t.vocab.learnNew}
            </LinkButton>
          )}
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
