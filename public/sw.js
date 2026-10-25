/*
 * BandUp service worker — deliberately conservative.
 *
 * - Hashed build assets (/_next/static/), icons and fonts: cache-first. Their URLs change
 *   whenever their content does, so a cached copy is never stale.
 * - Page navigations: always the network. Only when the network fails is a small offline
 *   page shown; authenticated HTML is never stored.
 * - Everything else (API routes, server actions, RSC payloads, uploads, audio): untouched.
 *   Practice data stays online.
 */

const VERSION = "v1";
const STATIC_CACHE = `bandup-static-${VERSION}`;
const OFFLINE_URL = "/__offline";
const PRECACHE = ["/icons/icon-192.png", "/icons/icon.svg"];

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline · BandUp</title>
<style>
  :root { color-scheme: light dark; --bg:#f7f7f5; --fg:#1b1d1f; --muted:#5f6368; --accent:#0f6e66; --border:#e2e2dc; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111314; --fg:#e8eaeb; --muted:#9aa1a5; --accent:#3fb8ac; --border:#2e3335; } }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); color:var(--fg); font:16px/1.5 system-ui, sans-serif; padding:16px; box-sizing:border-box; }
  main { max-width:420px; text-align:center; }
  h1 { font-size:1.4rem; margin:16px 0 4px; }
  p { color:var(--muted); margin:4px 0; }
  a { display:inline-block; margin-top:20px; padding:10px 16px; border-radius:4px; background:var(--accent); color:#fff; text-decoration:none; font-weight:600; }
</style>
</head>
<body>
<main>
  <svg width="48" height="48" viewBox="0 0 22 22" aria-hidden="true">
    <rect x="1" y="13" width="5" height="8" rx="1" fill="currentColor" opacity="0.45"/>
    <rect x="8.5" y="8" width="5" height="13" rx="1" fill="currentColor" opacity="0.7"/>
    <rect x="16" y="2" width="5" height="19" rx="1" fill="currentColor"/>
  </svg>
  <h1>You are offline</h1>
  <p>BandUp needs a connection to load lessons and save your answers.</p>
  <p lang="id">Anda sedang offline. BandUp butuh koneksi untuk memuat materi dan menyimpan jawaban.</p>
  <a href="/dashboard">Try again · Coba lagi</a>
</main>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(OFFLINE_URL, new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }));
      await cache.addAll(PRECACHE).catch(() => undefined);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("bandup-") && k !== STATIC_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || /\.(?:woff2?|ttf|otf)$/.test(url.pathname);
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

async function networkOrOffline(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    return (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkOrOffline(request));
    return;
  }
  if (isStaticAsset(url)) event.respondWith(cacheFirst(request));
});
