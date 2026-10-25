import type { GradedItem } from "@/lib/scoring/grade";
import { humanCategory } from "@/lib/plan/study-plan";
import { Card } from "@/components/ui";

/** Right/total per question type, weakest first. */
export function CategoryTable({ items, title }: { items: GradedItem[]; title: string }) {
  const by = new Map<string, { right: number; total: number }>();
  for (const i of items) {
    const row = by.get(i.category) ?? { right: 0, total: 0 };
    by.set(i.category, { right: row.right + (i.correct ? 1 : 0), total: row.total + 1 });
  }
  return (
    <Card className="p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="flex flex-col gap-2">
        {[...by.entries()]
          .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)
          .map(([cat, { right, total }]) => {
            const pct = right / total;
            return (
              <div key={cat} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[220px_1fr_auto]">
                <span className="text-sm">{humanCategory(cat as GradedItem["category"])}</span>
                <div className="order-3 col-span-2 h-2 rounded-sm bg-surface-2 sm:order-none sm:col-span-1">
                  <div className={`h-full rounded-sm ${pct >= 0.75 ? "bg-success" : pct >= 0.5 ? "bg-warning" : "bg-danger"}`} style={{ width: `${pct * 100}%` }} />
                </div>
                <span className="text-sm tabular-nums text-muted">
                  {right}/{total}
                </span>
              </div>
            );
          })}
      </div>
    </Card>
  );
}
