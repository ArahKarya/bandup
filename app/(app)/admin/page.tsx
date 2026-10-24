import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { getAdminStats } from "@/lib/server/stats";
import { db } from "@/lib/server/db";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { StatTile, SectionTitle } from "@/components/dashboard/stat-tile";
import { Card, PageHeader } from "@/components/ui";
import type { ContentKind } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminPage() {
  await requireAdmin();
  const { t } = await getDictionary();

  const [stats, content] = await Promise.all([
    getAdminStats(),
    db.contentItem.groupBy({ by: ["kind", "published"], _count: { _all: true } }),
  ]);
  const kinds = Object.keys(t.admin.kinds) as ContentKind[];
  const countOf = (kind: ContentKind, published: boolean) =>
    content.find((c) => c.kind === kind && c.published === published)?._count._all ?? 0;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.admin.title} sub={t.admin.sub} />
      <AdminTabs current="overview" t={t} />

      <section aria-label={t.admin.stats} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t.admin.usersCount} value={stats.users} />
        <StatTile label={t.admin.activeLearners} value={stats.activeLearners} />
        <StatTile label={t.admin.attemptsWeek} value={stats.attemptsWeek} />
        <StatTile label={t.admin.submissions} value={stats.submissions} hint={`+${stats.submissionsWeek} ${t.admin.submissionsWeek}`} />
      </section>

      <section className="mt-8">
        <SectionTitle>{t.admin.content}</SectionTitle>
        <Card className="divide-y divide-border">
          {kinds.map((kind) => (
            <div key={kind} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="font-medium">{t.admin.kinds[kind]}</span>
              <span className="tabular-nums text-muted">
                {countOf(kind, true)} {t.admin.published.toLowerCase()} · {countOf(kind, false)} {t.admin.unpublished.toLowerCase()}
              </span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
