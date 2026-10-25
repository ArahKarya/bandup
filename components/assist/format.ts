/**
 * "{n} words" interpolation for client components, without importing every message file into
 * the browser bundle (as `fmt` from lib/i18n/dictionaries would).
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}
