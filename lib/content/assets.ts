/** Content images live in content/assets and are served by app/api/assets/[file]. */
export const ASSET_NAME = /^[a-z0-9][a-z0-9._-]{0,120}\.(svg|png|jpg|jpeg|webp|mp3|m4a|ogg)$/i;

/** Accepts "map.svg" or "assets/map.svg" as authored. */
export function assetUrl(path: string): string {
  const name = path.replace(/^\/?(content\/)?assets\//, "");
  return `/api/assets/${encodeURIComponent(name)}`;
}
