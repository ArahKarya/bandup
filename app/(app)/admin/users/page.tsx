import type { Metadata } from "next";
import { requireAdmin } from "@/lib/server/auth";
import { getDictionary } from "@/lib/i18n/server";
import { db } from "@/lib/server/db";
import { fmt } from "@/lib/i18n/dictionaries";
import { formatDay } from "@/lib/stats/dates";
import { setRoleAction } from "@/app/actions/admin";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { ActionButton } from "@/components/admin/action-button";
import { Badge, Button, Empty, Input, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Users · Admin" };

const PAGE_SIZE = 200;
const th = "border-b border-border px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted";
const td = "border-b border-border px-3 py-2.5 align-middle";

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const admin = await requireAdmin();
  const { t, locale } = await getDictionary();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";

  const [users, adminCount] = await Promise.all([
    db.user.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : {},
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: { id: true, name: true, email: true, role: true, createdAt: true, lastLoginAt: true },
    }),
    db.user.count({ where: { role: "ADMIN" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t.admin.title} sub={t.admin.sub} />
      <AdminTabs current="users" t={t} />

      <form role="search" className="mb-4 flex gap-2">
        <label htmlFor="user-search" className="sr-only">
          {t.admin.search}
        </label>
        <Input id="user-search" name="q" type="search" defaultValue={q} placeholder={t.admin.searchUsers} className="max-w-sm" />
        <Button type="submit" variant="secondary">
          {t.admin.search}
        </Button>
      </form>

      {users.length === 0 ? (
        <Empty>{t.admin.noResults}</Empty>
      ) : (
        <div className="overflow-x-auto rounded border border-border bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className={th}>{t.admin.name}</th>
                <th scope="col" className={th}>{t.admin.email}</th>
                <th scope="col" className={th}>{t.admin.role}</th>
                <th scope="col" className={th}>{t.admin.created}</th>
                <th scope="col" className={th}>{t.admin.lastLogin}</th>
                <th scope="col" className={`${th} text-right`}>{t.admin.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.id === admin.id;
                const isAdmin = u.role === "ADMIN";
                // Mirrors the server-side rule so the button is disabled before anyone clicks.
                const locked = isAdmin && (isSelf || adminCount <= 1);
                const label = isAdmin ? t.admin.makeUser : t.admin.makeAdmin;
                return (
                  <tr key={u.id}>
                    <td className={`${td} font-medium`}>
                      {u.name} {isSelf && <Badge tone="accent" className="ml-1">{t.admin.you}</Badge>}
                    </td>
                    <td className={`${td} break-all text-muted`}>{u.email}</td>
                    <td className={td}>
                      <Badge tone={isAdmin ? "accent" : "neutral"}>{u.role}</Badge>
                    </td>
                    <td className={`${td} whitespace-nowrap text-muted`}>{formatDay(u.createdAt, locale)}</td>
                    <td className={`${td} whitespace-nowrap text-muted`}>{u.lastLoginAt ? formatDay(u.lastLoginAt, locale) : t.admin.never}</td>
                    <td className={`${td} text-right`}>
                      <ActionButton
                        action={setRoleAction}
                        fields={{ userId: u.id, role: isAdmin ? "USER" : "ADMIN" }}
                        label={label}
                        ariaLabel={`${label}: ${u.name}`}
                        errors={t.admin.errors}
                        disabled={locked}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {users.length === PAGE_SIZE && <p className="mt-2 text-xs text-muted">{fmt(t.admin.showing, { n: PAGE_SIZE })}</p>}
    </div>
  );
}
