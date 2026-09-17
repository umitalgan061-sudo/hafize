importScripts('/sw-policy.js');

// `self` klasik bir worker script'inde `WorkerGlobalScope` olarak bilinir;
// service worker'a özgü `skipWaiting`, `clients` ve `FetchEvent` yalnızca
// `ServiceWorkerGlobalScope` üzerinde vardır. Tek bir daraltma ile tip
// denetleyicisine doğru kapsam tanıtılır; çalışma zamanında değişen bir şey
// yoktur, `sw` ile `self` aynı nesnedir.
const sw = /** @type {ServiceWorkerGlobalScope & typeof globalThis} */ (/** @type {unknown} */ (self));

const {
  CURRENT_CACHE,
  SHELL_ASSETS,
  classifyRequest,
  shouldDeleteCache
} = sw.HafizeSwPolicy;

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function matchShell(request) {
  const cache = await caches.open(CURRENT_CACHE);
  const cached = await cache.match(request, { ignoreSearch: true });
  return cached || fetch(request);
}

/**
 * @param {Request} request
 * @returns {Promise<Response>}
 */
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

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CURRENT_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => shouldDeleteCache(key)).map((key) => caches.delete(key))
    ))
  );
  sw.clients.claim();
});

sw.addEventListener('fetch', (event) => {
  const strategy = classifyRequest(event.request, sw.location.origin);

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
