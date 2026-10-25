"use client";

import { useMemo, useState } from "react";
import { Dumbbell } from "lucide-react";
import { drillMistakesAction } from "@/app/actions/mistakes";
import { Button, SkillIcon, isSkillKey } from "@/components/ui";
import { MistakeCard, type MistakeCardItem, type MistakeCardLabels } from "./mistake-card";

export interface MistakeListLabels extends MistakeCardLabels {
  drillSelected: string;
  drillTop: string;
  drillHint: string;
  selectAll: string;
  selectNone: string;
  setGone: string;
}

export interface MistakeListSet {
  setId: string;
  title: string | null;
  skill: string;
}

interface MistakeListProps {
  sets: MistakeListSet[];
  items: MistakeCardItem[];
  filter: { skill?: string; type?: string };
  topCount: number;
  limit: number;
  labels: MistakeListLabels;
}

const fill = (template: string, n: number) => template.replace("{n}", String(n));

/** The notebook list: grouped by set, with checkboxes feeding "Drill selected". */
export function MistakeList({ sets, items, filter, topCount, limit, labels }: MistakeListProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const bySet = useMemo(() => {
    const map = new Map<string, MistakeCardItem[]>();
    for (const item of items) map.set(item.setId, [...(map.get(item.setId) ?? []), item]);
    return map;
  }, [items]);
  const openIds = useMemo(() => items.filter((i) => !i.mastered).map((i) => i.id), [items]);
  // Drop selections whose item left the list (mastered and hidden, or filtered out).
  const live = [...selected].filter((id) => items.some((i) => i.id === id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = openIds.length > 0 && openIds.every((id) => selected.has(id));

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 border-b border-border bg-bg/95 px-1 py-3 backdrop-blur">
        <form action={drillMistakesAction}>
          <input type="hidden" name="mode" value="selected" />
          {live.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <Button type="submit" disabled={live.length === 0}>
            <Dumbbell size={16} aria-hidden="true" />
            {fill(labels.drillSelected, live.length)}
          </Button>
        </form>
        <form action={drillMistakesAction}>
          <input type="hidden" name="mode" value="top" />
          <input type="hidden" name="skill" value={filter.skill ?? ""} />
          <input type="hidden" name="type" value={filter.type ?? ""} />
          <Button type="submit" variant="secondary" disabled={openIds.length === 0}>
            {fill(labels.drillTop, topCount)}
          </Button>
        </form>
        <Button type="button" variant="ghost" size="sm" disabled={openIds.length === 0} onClick={() => setSelected(allSelected ? new Set() : new Set(openIds))}>
          {allSelected ? labels.selectNone : labels.selectAll}
        </Button>
        <p className="w-full text-xs text-muted sm:ml-auto sm:w-auto">{fill(labels.drillHint, limit)}</p>
      </div>

      {sets.map((set) => (
        <section key={set.setId} aria-labelledby={`set-${set.setId}`} className="flex flex-col gap-2">
          <h2 id={`set-${set.setId}`} className="flex items-center gap-2 font-semibold">
            {isSkillKey(set.skill) && <SkillIcon skill={set.skill} size="sm" />}
            {set.title ?? <span className="text-muted">{labels.setGone}</span>}
          </h2>
          <ul className="flex flex-col gap-2">
            {(bySet.get(set.setId) ?? []).map((item) => (
              <li key={item.id}>
                <MistakeCard item={item} selected={selected.has(item.id)} onSelect={() => toggle(item.id)} labels={labels} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
