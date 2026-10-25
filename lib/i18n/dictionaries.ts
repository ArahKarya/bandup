/**
 * UI strings. Learning content itself stays in English (it is IELTS material); only the
 * interface around it is translated. Strings live per area in lib/i18n/messages/; add a
 * language by adding an object next to `en` and `id` in each file.
 */

import * as core from "./messages/core";
import * as auth from "./messages/auth";
import * as learn from "./messages/learn";
import * as practice from "./messages/practice";
import * as assess from "./messages/assess";
import * as progress from "./messages/progress";
import * as settings from "./messages/settings";
import * as exam from "./messages/exam";
import * as mistakes from "./messages/mistakes";
import * as motivation from "./messages/motivation";
import * as assist from "./messages/assist";

/**
 * Each area keeps its strings in lib/i18n/messages/<area>.ts with an `en` object and an `id`
 * object typed against it, so a missing translation fails the type check in that file.
 */
const MODULES = [core, auth, learn, practice, assess, progress, settings, exam, mistakes, motivation, assist] as const;

const en = Object.assign({}, ...MODULES.map((m) => m.en)) as MergeEn<typeof MODULES>;
const id = Object.assign({}, ...MODULES.map((m) => m.id)) as MergeEn<typeof MODULES>;

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never;
type MergeEn<T extends readonly { en: object }[]> = UnionToIntersection<T[number]["en"]>;

export type Dictionary = typeof en;
export const dictionaries = { en, id } as const;
export type Locale = keyof typeof dictionaries;
export const LOCALES: Locale[] = ["id", "en"];
export const isLocale = (v: unknown): v is Locale => v === "id" || v === "en";

/** "{n} words" style interpolation. */
export function fmt(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}
