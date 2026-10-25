import Link from "next/link";
import { Trophy } from "lucide-react";
import type { AchievementView } from "@/lib/achievements/rules";
import { fmt, type Dictionary } from "@/lib/i18n/dictionaries";
import { SectionHeading } from "@/components/ui";
import { AchievementBadge } from "./badge";

/** A few recent badges plus the closest locked ones, linking to the full page. */

const PREVIEW_SIZE = 4;

export function previewViews(views: readonly AchievementView[], size = PREVIEW_SIZE): AchievementView[] {
  const earned = views.filter((v) => v.earnedAt).sort((a, b) => (b.earnedAt?.getTime() ?? 0) - (a.earnedAt?.getTime() ?? 0));
  const next = views.filter((v) => !v.earnedAt).sort((a, b) => b.ratio - a.ratio);
  const half = Math.ceil(size / 2);
  // Newest wins first, then the badges closest to unlocking, then older wins as filler.
  return [...earned.slice(0, half), ...next, ...earned.slice(half)].slice(0, size);
}

export function AchievementsPreview({ views, t, locale }: { views: AchievementView[]; t: Dictionary; locale: string }) {
  const earnedCount = views.filter((v) => v.earnedAt).length;
  return (
    <section>
      <SectionHeading
        icon={<Trophy size={18} className="text-warning" aria-hidden="true" />}
        action={
          <Link href="/achievements" className="text-sm text-accent hover:underline">
            {t.motivation.seeAll}
          </Link>
        }
      >
        {t.motivation.achievements}
        <span className="text-sm font-normal text-muted">{fmt(t.motivation.earnedCount, { n: earnedCount, total: views.length })}</span>
      </SectionHeading>
      <ul className="grid gap-3 sm:grid-cols-2">
        {previewViews(views).map((v) => (
          <AchievementBadge key={v.rule.key} view={v} t={t} locale={locale} compact />
        ))}
      </ul>
    </section>
  );
}
