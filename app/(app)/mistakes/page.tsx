import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, NotebookPen, Star, Target } from "lucide-react";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";
import { humanCategory } from "@/lib/plan/study-plan";
import { DRILL_LIMIT, TOP_MISSED } from "@/lib/mistakes/drill";
import { EmptyState, LinkButton, PageHeader, Stat } from "@/components/ui";
import { Tabs } from "@/components/ui/tabs";
import { MistakeFilters } from "@/components/mistakes/mistake-filters";
import { MistakeList, type MistakeListLabels } from "@/components/mistakes/mistake-list";
import { BookmarkList } from "@/components/mistakes/bookmark-list";
import { DRILLABLE_SKILLS, loadBookmarks, loadItems, loadStats, parseFilter } from "./data";

export const metadata: Metadata = { title: "Mistake notebook" };

function listLabels(t: Dictionary): MistakeListLabels {
  const m = t.mistakes;
  return {
    drillSelected: m.drillSelected,
    drillTop: m.drillTop,
    drillHint: m.drillHint,
    selectAll: m.selectAll,
    selectNone: m.selectNone,
    setGone: m.setGone,
    question: m.question,
    selectItem: m.selectItem,
    yourAnswer: t.review.yourAnswer,
    correctAnswer: t.review.correctAnswer,
    evidence: t.review.evidence,
    timesWrong: m.timesWrong,
    streak: m.streak,
    mastered: m.mastered,
    markMastered: m.markMastered,
    keepPractising: m.keepPractising,
    masteredToast: m.masteredToast,
    unmasteredToast: m.unmasteredToast,
    error: t.common.error,
  };
}

export default async function MistakesPage({ searchParams }: PageProps<"/mistakes">) {
  const user = await requireLearner();
  const params = await searchParams;
  const filter = parseFilter(params);
  const tab = params.tab === "bookmarks" ? "bookmarks" : "mistakes";
  const [{ t }, stats, list, bookmarks] = await Promise.all([getDictionary(), loadStats(user.id), loadItems(user.id, filter), loadBookmarks(user.id)]);
  const m = t.mistakes;

  const mistakesTab = !stats.hasAny ? (
    <EmptyState illustration="notebook" title={m.emptyTitle} body={m.emptyBody} action={<LinkButton href="/practice">{m.emptyAction}</LinkButton>} />
  ) : (
    <div className="flex flex-col gap-5">
      <MistakeFilters
        skills={DRILLABLE_SKILLS.map((s) => ({ value: s, label: t.skill[s] }))}
        types={stats.categories.map((c) => ({ value: c, label: humanCategory(c) }))}
        current={filter}
        labels={{ filters: m.filters, skill: m.filterSkill, type: m.filterType, allSkills: m.allSkills, allTypes: m.allTypes, showMastered: m.showMastered, apply: m.apply, reset: m.reset }}
      />
      {list.items.length === 0 ? (
        <EmptyState compact illustration="notebook" title={m.emptyFiltered} />
      ) : (
        <MistakeList sets={list.sets} items={list.items} filter={filter} topCount={TOP_MISSED} limit={DRILL_LIMIT} labels={listLabels(t)} />
      )}
    </div>
  );

  const bookmarkCount = bookmarks.questions.length + bookmarks.lessons.length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader title={m.title} sub={m.sub} icon={<NotebookPen size={20} aria-hidden="true" />} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={m.statOpen} value={stats.open} icon={<CircleAlert size={18} className="text-danger" aria-hidden="true" />} />
        <Stat label={m.statMastered} value={stats.masteredThisWeek} icon={<CheckCircle2 size={18} className="text-success" aria-hidden="true" />} />
        <Stat
          label={m.statMostMissed}
          value={<span className="text-lg">{stats.mostMissed?.label ?? "—"}</span>}
          icon={<Target size={18} className="text-warning" aria-hidden="true" />}
          hint={stats.mostMissed ? fmt(m.statMostMissedHint, { n: stats.mostMissed.count }) : undefined}
        />
      </div>

      <Tabs
        initial={tab}
        items={[
          { id: "mistakes", label: <>{m.tabMistakes} <span className="tabular-nums text-muted">({stats.open})</span></>, content: mistakesTab },
          {
            id: "bookmarks",
            label: (
              <>
                <Star size={14} aria-hidden="true" />
                {m.tabBookmarks} <span className="tabular-nums text-muted">({bookmarkCount})</span>
              </>
            ),
            content: (
              <BookmarkList
                questions={bookmarks.questions}
                lessons={bookmarks.lessons}
                labels={{
                  questions: m.bookmarkedQuestions,
                  lessons: m.bookmarkedLessons,
                  emptyTitle: m.bookmarksEmptyTitle,
                  emptyBody: m.bookmarksEmptyBody,
                  drillAll: m.drillBookmarks,
                  drill: m.drill,
                  openLesson: m.openLesson,
                  question: m.question,
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
