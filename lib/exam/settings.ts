/** Per-device exam display settings (kept in localStorage, never on the server). */

export type TextSize = "s" | "m" | "l";
export type Contrast = "standard" | "yellow-black" | "black-cream";
export type PassageFont = "serif" | "sans";

export interface ExamSettings {
  textSize: TextSize;
  contrast: Contrast;
  font: PassageFont;
}

export const SETTINGS_KEY = "bandup.exam.settings";
export const DEFAULT_SETTINGS: ExamSettings = { textSize: "m", contrast: "standard", font: "serif" };

const TEXT_SIZES: readonly TextSize[] = ["s", "m", "l"];
const CONTRASTS: readonly Contrast[] = ["standard", "yellow-black", "black-cream"];
const FONTS: readonly PassageFont[] = ["serif", "sans"];

function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Reads stored JSON defensively; anything unknown falls back to the default. */
export function parseSettings(raw: string | null): ExamSettings {
  if (!raw) return DEFAULT_SETTINGS;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
  if (!data || typeof data !== "object") return DEFAULT_SETTINGS;
  const r = data as Record<string, unknown>;
  return {
    textSize: pick(TEXT_SIZES, r.textSize, DEFAULT_SETTINGS.textSize),
    contrast: pick(CONTRASTS, r.contrast, DEFAULT_SETTINGS.contrast),
    font: pick(FONTS, r.font, DEFAULT_SETTINGS.font),
  };
}

/** Root font size: Tailwind sizes are in rem, so scaling the root scales the whole runner. */
export const TEXT_SIZE_PCT: Record<TextSize, string> = { s: "93.75%", m: "100%", l: "118.75%" };

/**
 * Colour tokens overridden on the runner root for the high-contrast schemes. Highlights get
 * colours that keep the scheme's text readable on top of them.
 */
export const CONTRAST_VARS: Record<Contrast, Record<string, string>> = {
  standard: {},
  "yellow-black": {
    "--bg": "#000000",
    "--surface": "#000000",
    "--surface-2": "#1c1c1c",
    "--border": "#bfbf00",
    "--text": "#ffff00",
    "--text-muted": "#e6e600",
    "--accent": "#ffff00",
    "--accent-hover": "#ffff66",
    "--accent-soft": "#333300",
    "--accent-fg": "#000000",
    "--mark": "#1d3a8a",
    "--note": "#6b1d6b",
    "--success": "#7dff7d",
    "--success-soft": "#0d260d",
    "--danger": "#ff8080",
    "--danger-soft": "#2b0d0d",
    "--warning": "#ffd24d",
    "--warning-soft": "#2b220d",
    "color-scheme": "dark",
  },
  "black-cream": {
    "--bg": "#fbf3dc",
    "--surface": "#fdf8e8",
    "--surface-2": "#f1e7c8",
    "--border": "#8c805c",
    "--text": "#000000",
    "--text-muted": "#2e2a20",
    "--accent": "#0b4f49",
    "--accent-hover": "#083d38",
    "--accent-soft": "#e3ecd9",
    "--accent-fg": "#ffffff",
    "--mark": "#ffd84d",
    "--note": "#9cc8ff",
    "color-scheme": "light",
  },
};
