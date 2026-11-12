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

// A push carries nothing (see hafize-worker/src/push.js), so the line is fixed and the result is read in the app.
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // Someone looking at Hafize already sees it there; a phone in a pocket does not.
    if (open.some((client) => client.visibilityState === 'visible' && client.focused)) return;
    await self.registration.showNotification('Hafize', { body: 'Arka plandaki bir işin bitti. Sonucu görmek için dokun.', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'hafize-arka-plan', renotify: true });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const data = event.notification.data || {};
    // The push itself carries nothing, so the address says "opened from a notice" and the app looks up what it was.
    const deepLink = data.deepLink || '/?bildirim=1';
    const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = open.find((client) => new URL(client.url).origin === self.location.origin);
    if (app) {
      await app.focus();
      app.postMessage({ type: 'hafize:push-open', deepLink });
      return;
    }
    await self.clients.openWindow(deepLink);
  })());
});