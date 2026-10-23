// @ts-nocheck
import { CURRENT_CACHE, SHELL_ASSETS, classifyRequest, shouldDeleteCache } from './sw-policy.ts';

// Network first: the server is local, so this is fast, and a new build is picked up on the
// next load instead of being shadowed by an older cached copy. The cache is only the offline fallback.
async function matchShell(request) {
  const cache = await caches.open(CURRENT_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => undefined);
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

async function navigateWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CURRENT_CACHE);
    return (await cache.match('/index.html')) || (await cache.match('/offline.html')) || Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CURRENT_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(shouldDeleteCache).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const strategy = classifyRequest(event.request, self.location.origin);
  if (strategy === 'navigation') {
    event.respondWith(navigateWithOfflineFallback(event.request));
    return;
  }
  if (strategy === 'shell') event.respondWith(matchShell(event.request));
});
