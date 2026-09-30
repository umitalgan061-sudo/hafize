/// <reference lib="webworker" />
import { CURRENT_CACHE, SHELL_ASSETS, classifyRequest, shouldDeleteCache } from './sw-policy.ts';

const scope = self as unknown as ServiceWorkerGlobalScope;

async function matchShell(request: Request): Promise<Response> {
  const cache = await caches.open(CURRENT_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  return cached || fetch(request);
}

async function navigateWithOfflineFallback(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CURRENT_CACHE);
    return (await cache.match('/index.html')) || (await cache.match('/offline.html')) || Response.error();
  }
}

scope.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CURRENT_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => scope.skipWaiting()));
});

scope.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter(shouldDeleteCache).map((key) => caches.delete(key)))));
  scope.clients.claim();
});

scope.addEventListener('fetch', (event) => {
  const strategy = classifyRequest(event.request, scope.location.origin);
  if (strategy === 'navigation') {
    event.respondWith(navigateWithOfflineFallback(event.request));
    return;
  }
  if (strategy === 'shell') event.respondWith(matchShell(event.request));
});
