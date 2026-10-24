import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/server/db";
import { fmt } from "@/lib/i18n/dictionaries";
import { setPublishedAction } from "@/app/actions/admin";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { ActionButton } from "@/components/admin/action-button";
import { SectionTitle } from "@/components/dashboard/stat-tile";
import { Badge, Button, Empty, Input, PageHeader, Select } from "@/components/ui";
import { ContentKind } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Content · Admin" };

const LIMIT = 500;
const KINDS = Object.values(ContentKind);
const isKind = (v: unknown): v is ContentKind => typeof v === "string" && (KINDS as string[]).includes(v);

export default async function AdminContentPage({ searchParams }: PageProps<"/admin/content">) {
  await requireAdmin();
  const { t } = await getDictionary();
  const sp = await searchParams;
  const kind = isKind(sp.kind) ? sp.kind : null;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";

  const items = await db.contentItem.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { id: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
    take: LIMIT,
    select: { id: true, kind: true, title: true, skill: true, module: true, category: true, published: true, unlisted: true },
  });
  const groups = KINDS.map((k) => ({ kind: k, items: items.filter((i) => i.kind === k) })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.admin.title} sub={t.admin.sub} />
      <AdminTabs current="content" t={t} />

      <form role="search" className="mb-6 flex flex-wrap gap-2">
        <label htmlFor="content-kind" className="sr-only">{t.admin.kind}</label>
        <Select id="content-kind" name="kind" defaultValue={kind ?? ""} className="w-auto">
          <option value="">{t.admin.allKinds}</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{t.admin.kinds[k]}</option>
          ))}
        </Select>
        <label htmlFor="content-search" className="sr-only">{t.admin.search}</label>
        <Input id="content-search" name="q" type="search" defaultValue={q} placeholder={t.admin.searchContent} className="max-w-xs" />
        <Button type="submit" variant="secondary">{t.admin.apply}</Button>
      </form>

      {groups.length === 0 ? (
        <Empty>{t.admin.noResults}</Empty>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.kind} aria-labelledby={`kind-${g.kind}`}>
              <SectionTitle action={<span className="text-sm text-muted">{g.items.length} {t.admin.items}</span>}>
                <span id={`kind-${g.kind}`}>{t.admin.kinds[g.kind]}</span>
              </SectionTitle>
              <ul className="divide-y divide-border rounded border border-border bg-surface">
                {g.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{item.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <code className="break-all">{item.id}</code>
                        {[item.skill, item.module, item.category].filter(Boolean).map((tag, i) => (
                          <Badge key={`${i}-${tag}`}>{tag}</Badge>
                        ))}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={item.published ? "success" : "warning"}>{item.published ? t.admin.published : t.admin.unpublished}</Badge>
                      <ActionButton
                        action={setPublishedAction}
                        fields={{ contentId: item.id, published: String(!item.published) }}
                        label={item.published ? t.admin.unpublish : t.admin.publish}
                        ariaLabel={`${item.published ? t.admin.unpublish : t.admin.publish}: ${item.title}`}
                        errors={t.admin.errors}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {items.length === LIMIT && <p className="mt-2 text-xs text-muted">{fmt(t.admin.showing, { n: LIMIT })}</p>}
    </div>
  );
}
