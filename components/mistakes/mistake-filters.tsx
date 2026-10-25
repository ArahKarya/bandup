import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button, Select } from "@/components/ui";

export interface MistakeFiltersProps {
  skills: { value: string; label: string }[];
  types: { value: string; label: string }[];
  current: { skill?: string; type?: string; showMastered: boolean };
  labels: { filters: string; skill: string; type: string; allSkills: string; allTypes: string; showMastered: string; apply: string; reset: string };
}

/** Plain GET form, so filters live in the URL and work without JavaScript. */
export function MistakeFilters({ skills, types, current, labels }: MistakeFiltersProps) {
  const filtered = Boolean(current.skill || current.type || current.showMastered);
  return (
    <form method="get" action="/mistakes" className="flex flex-wrap items-end gap-3" aria-label={labels.filters}>
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-medium sm:flex-none">
        {labels.skill}
        <Select name="skill" defaultValue={current.skill ?? ""}>
          <option value="">{labels.allSkills}</option>
          {skills.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm font-medium sm:flex-none">
        {labels.type}
        <Select name="type" defaultValue={current.type ?? ""}>
          <option value="">{labels.allTypes}</option>
          {types.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex h-10 items-center gap-2 text-sm">
        <input type="checkbox" name="mastered" value="1" defaultChecked={current.showMastered} className="h-4 w-4 accent-[var(--accent)]" />
        {labels.showMastered}
      </label>
      <div className="flex gap-2">
        <Button type="submit" variant="secondary">
          <SlidersHorizontal size={16} aria-hidden="true" />
          {labels.apply}
        </Button>
        {filtered && (
          <Link href="/mistakes" className="inline-flex h-10 items-center px-2 text-sm text-muted hover:text-fg">
            {labels.reset}
          </Link>
        )}
      </div>
    </form>
  );
}
