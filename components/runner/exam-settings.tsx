"use client";

import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { Settings2 } from "lucide-react";
import type { ExamLabels } from "@/lib/i18n/messages/exam";
import {
  CONTRAST_VARS,
  DEFAULT_SETTINGS,
  parseSettings,
  SETTINGS_KEY,
  TEXT_SIZE_PCT,
  type Contrast,
  type ExamSettings,
  type PassageFont,
  type TextSize,
} from "@/lib/exam/settings";
import { Popover } from "./popover";

/* A tiny external store so every runner part reads the same settings without prop drilling. */

const listeners = new Set<() => void>();
let cached: { raw: string | null; value: ExamSettings } | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(SETTINGS_KEY);
  } catch {
    return null;
  }
}

function snapshot(): ExamSettings {
  const raw = readRaw();
  if (!cached || cached.raw !== raw) cached = { raw, value: parseSettings(raw) };
  return cached.value;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SETTINGS_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function save(next: ExamSettings): void {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(SETTINGS_KEY, raw);
    cached = null;
  } catch {
    // Storage blocked (private mode): keep the change for this page only.
    cached = { raw: readRaw(), value: next };
  }
  for (const l of listeners) l();
}

export function useExamSettings(): [ExamSettings, (patch: Partial<ExamSettings>) => void] {
  const settings = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_SETTINGS);
  return [settings, (patch) => save({ ...settings, ...patch })];
}

/** Scales the root font size while the runner is open (Tailwind sizes are rem-based). */
export function useRootTextSize(size: TextSize): void {
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.fontSize;
    html.style.fontSize = TEXT_SIZE_PCT[size];
    return () => {
      html.style.fontSize = previous;
    };
  }, [size]);
}

export function contrastStyle(contrast: Contrast): CSSProperties {
  return CONTRAST_VARS[contrast] as CSSProperties;
}

function Choice<T extends string>({ name, legend, value, options, onChange }: { name: string; legend: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{legend}</legend>
      <div className="grid grid-cols-3 gap-1" role="radiogroup">
        {options.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center justify-center rounded border px-2 py-1.5 text-center text-xs focus-within:outline-2 focus-within:outline-accent ${value === o.value ? "border-accent bg-accent-soft font-semibold text-accent" : "border-border hover:bg-surface-2"}`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ExamSettingsPanel({ labels }: { labels: ExamLabels }) {
  const [settings, update] = useExamSettings();
  return (
    <Popover label={labels.settings} trigger={<><Settings2 size={16} aria-hidden="true" /><span className="hidden md:inline">{labels.settings}</span></>}>
      <div className="flex flex-col gap-4">
        <Choice<TextSize>
          name="exam-text-size"
          legend={labels.textSize}
          value={settings.textSize}
          onChange={(textSize) => update({ textSize })}
          options={[
            { value: "s", label: labels.sizeS },
            { value: "m", label: labels.sizeM },
            { value: "l", label: labels.sizeL },
          ]}
        />
        <Choice<Contrast>
          name="exam-contrast"
          legend={labels.contrast}
          value={settings.contrast}
          onChange={(contrast) => update({ contrast })}
          options={[
            { value: "standard", label: labels.contrastStandard },
            { value: "yellow-black", label: labels.contrastYellow },
            { value: "black-cream", label: labels.contrastCream },
          ]}
        />
        <Choice<PassageFont>
          name="exam-font"
          legend={labels.passageFont}
          value={settings.font}
          onChange={(font) => update({ font })}
          options={[
            { value: "serif", label: labels.fontSerif },
            { value: "sans", label: labels.fontSans },
          ]}
        />
      </div>
    </Popover>
  );
}
