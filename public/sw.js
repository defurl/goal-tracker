/* global self, caches, fetch, Response, URL, location */
// The service worker (B2.9). D-07: it caches the /text SHELL — the page and
// exactly the assets that page references — and NOT the 3D bundle. The room
// is the evening surface; /text is the one that has to work on a train.
//
// Never cached, never intercepted:
//   /api/*, /auth/*      the agents and sign-in — their answers are per-user and live
//   other origins        Supabase and the model provider; data is not the SW's job
//
// The user's data offline comes from the store snapshot lib/data/ keeps in
// localStorage, not from here. The /text HTML is prerendered and holds no
// user data, so caching it caches nobody's anything.

const CACHE = 'bbe-text-shell-v1';
const SHELL = '/text';
const STATIC = ['/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg'];

/** Every /_next/static asset a document or stylesheet names. */
function referencedAssets(source) {
  const found = new Set();
  for (const match of source.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) found.add(match[1]);
  for (const match of source.matchAll(/url\((\/_next\/static\/[^)"']+)\)/g)) found.add(match[1]);
  return found;
}

/** Fetch the shell, cache it and everything it needs, and drop what it no longer needs. */
async function cacheShell(response) {
  const cache = await caches.open(CACHE);
  const page = response ?? (await fetch(SHELL, { credentials: 'same-origin' }));
  if (!page.ok) return;

  const assets = referencedAssets(await page.clone().text());
  await cache.put(SHELL, page);

  for (const url of [...assets]) {
    if (!url.endsWith('.css')) continue;
    const css = await fetch(url).catch(() => null);
    if (!css || !css.ok) continue;
    for (const inner of referencedAssets(await css.clone().text())) assets.add(inner);
    await cache.put(url, css);
  }
  await Promise.all(
    [...assets, ...STATIC].map((url) => cache.add(url).catch(() => undefined)),
  );

  // A new deploy renames every chunk; the old ones are dead weight.
  const keep = new Set([SHELL, ...assets, ...STATIC].map((u) => new URL(u, location.origin).href));
  for (const request of await cache.keys()) {
    if (!keep.has(request.url)) await cache.delete(request);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShell().catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Every online visit to /text refreshes the shell for the next offline one.
          if (url.pathname === SHELL && response.ok) event.waitUntil(cacheShell(response.clone()));
          return response;
        })
        .catch(async () => {
          // Offline. /text is served from the cache; anything else is sent there,
          // because the room's bundle is deliberately not cached.
          if (url.pathname === SHELL) return (await caches.match(SHELL)) ?? Response.error();
          return Response.redirect(SHELL, 302);
        }),
    );
    return;
  }

  // Cached shell assets only; nothing is added at runtime, so the 3D chunks a
  // visit to the room downloads never enter the cache.
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
});
