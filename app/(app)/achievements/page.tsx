import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { requireLearner } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { awardAchievements, getAchievementViews, markSeen } from "@/lib/server/achievements";
import type { AchievementGroup } from "@/lib/achievements/rules";
import { fmt } from "@/lib/i18n/dictionaries";
import { EmptyState, LinkButton, PageHeader, ProgressRing, SectionHeading } from "@/components/ui";
import { AchievementBadge } from "@/components/achievements/badge";

export const metadata: Metadata = { title: "Achievements" };

const GROUP_ORDER: readonly AchievementGroup[] = ["start", "habit", "vocab", "lessons", "bands", "practice"];

export default async function AchievementsPage() {
  const user = await requireLearner();
  const { t, locale } = await getDictionary();

  // Catches up badges earned before achievements existed (no toast while rendering).
  await awardAchievements(user.id, { notify: false });
  const { views, unseen } = await getAchievementViews(user.id);
  if (unseen.size > 0) await markSeen(user.id);

  const earned = views.filter((v) => v.earnedAt).length;
  const m = t.motivation;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <PageHeader
        title={m.achievements}
        sub={m.achievementsSub}
        icon={<Trophy size={20} aria-hidden="true" />}
        actions={
          <div className="flex items-center gap-3">
            <ProgressRing value={views.length ? earned / views.length : 0} size={56} stroke={6} color="var(--warning)" label={fmt(m.earnedCount, { n: earned, total: views.length })}>
              <span className="text-xs font-semibold tabular-nums">
                {earned}/{views.length}
              </span>
            </ProgressRing>
          </div>
        }
      />

      {earned === 0 && (
        <EmptyState
          illustration="trophy"
          title={m.noneYet}
          body={m.noneYetBody}
          action={<LinkButton href="/practice">{t.nav.practice}</LinkButton>}
        />
      )}

      {GROUP_ORDER.map((group) => {
        const items = views.filter((v) => v.rule.group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`group-${group}`}>
            <SectionHeading>
              <span id={`group-${group}`}>{m.groups[group]}</span>
            </SectionHeading>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((v) => (
                <AchievementBadge key={v.rule.key} view={v} t={t} locale={locale} isNew={unseen.has(v.rule.key)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
