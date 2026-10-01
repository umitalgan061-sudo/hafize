importScripts('/sw-policy.js');

const {
  CURRENT_CACHE,
  SHELL_ASSETS,
  classifyRequest,
  shouldDeleteCache
} = self.HafizeSwPolicy;

async function matchShell(request) {
  const cache = await caches.open(CURRENT_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  return cached || fetch(request);
}

async function navigateWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CURRENT_CACHE);
    return (await cache.match('/index.html'))
      || (await cache.match('/offline.html'))
      || Response.error();
  }
}

// The navigation fallback is the only part of the shell the app cannot work
// without, so it stays strict. Everything else is precached one request at a
// time: a single asset that 404s after a rename degrades that one file instead
// of rejecting `addAll` and leaving the install — and therefore offline mode —
// permanently broken.
const CRITICAL_SHELL_ASSETS = Object.freeze(['/index.html', '/offline.html']);

async function precacheShell() {
  const cache = await caches.open(CURRENT_CACHE);
  await cache.addAll(CRITICAL_SHELL_ASSETS);
  const optional = SHELL_ASSETS.filter((asset) => !CRITICAL_SHELL_ASSETS.includes(asset));
  await Promise.all(optional.map((asset) => cache.add(asset).catch(() => undefined)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => shouldDeleteCache(key)).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const strategy = classifyRequest(event.request, self.location.origin);

  if (strategy === 'navigation') {
    event.respondWith(navigateWithOfflineFallback(event.request));
    return;
  }

  if (strategy === 'shell') {
    event.respondWith(matchShell(event.request));
  }
  // `network-only` and `ignore` intentionally fall through to the browser.
  // API/tool responses, range requests and cross-origin content are never cached here.
});