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

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CURRENT_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
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
