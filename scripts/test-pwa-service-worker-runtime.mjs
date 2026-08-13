import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const policy = require('../public/sw-policy.js');
const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://hafize.example';
const handlers = new Map();
const deleted = [];
let cachedAssets = null;
let skipWaitingCalled = false;
let claimCalled = false;
let fetchCalls = 0;
let fetchImpl = async () => ({ source: 'network' });

function pathOf(input) {
  if (typeof input === 'string') return input;
  return new URL(input.url).pathname;
}

const cache = {
  async addAll(assets) {
    cachedAssets = [...assets];
  },
  async match(input) {
    const path = pathOf(input);
    if (path === '/index.html') return { source: 'cached-index' };
    if (path === '/offline.html') return { source: 'cached-offline' };
    if (path === '/app.js') return { source: 'cached-app' };
    return null;
  }
};

const context = {
  importScripts(path) {
    assert.equal(path, '/sw-policy.js');
  },
  caches: {
    async open(name) {
      assert.equal(name, policy.CURRENT_CACHE);
      return cache;
    },
    async keys() {
      return ['hafize-shell-v9', policy.CURRENT_CACHE, 'other-app-cache-v1'];
    },
    async delete(name) {
      deleted.push(name);
      return true;
    }
  },
  fetch(request) {
    fetchCalls += 1;
    return fetchImpl(request);
  },
  Response: {
    error() {
      return { source: 'response-error' };
    }
  },
  self: {
    HafizeSwPolicy: policy,
    location: { origin },
    addEventListener(type, handler) {
      handlers.set(type, handler);
    },
    skipWaiting() {
      skipWaitingCalled = true;
    },
    clients: {
      claim() {
        claimCalled = true;
      }
    }
  }
};
vm.runInNewContext(source, context, { filename: 'public/sw.js' });

let installPromise;
handlers.get('install')({ waitUntil(value) { installPromise = value; } });
await installPromise;
assert.deepEqual(cachedAssets, [...policy.SHELL_ASSETS]);
assert.equal(skipWaitingCalled, true);

let activatePromise;
handlers.get('activate')({ waitUntil(value) { activatePromise = value; } });
await activatePromise;
assert.deepEqual(deleted, ['hafize-shell-v9']);
assert.equal(claimCalled, true);

async function dispatchFetch(path, options = {}) {
  let responsePromise = null;
  const request = {
    url: path.startsWith('http') ? path : new URL(path, origin).href,
    method: options.method ?? 'GET',
    mode: options.mode ?? 'same-origin',
    headers: options.headers ?? {}
  };
  handlers.get('fetch')({ request, respondWith(value) { responsePromise = value; } });
  return responsePromise ? responsePromise : null;
}

fetchImpl = async () => ({ source: 'network-navigation' });
assert.deepEqual(await dispatchFetch('/chat', { mode: 'navigate' }), { source: 'network-navigation' });

fetchImpl = async () => { throw new Error('offline'); };
assert.deepEqual(await dispatchFetch('/chat', { mode: 'navigate' }), { source: 'cached-index' });

fetchCalls = 0;
assert.deepEqual(await dispatchFetch('/app.js'), { source: 'cached-app' });
assert.equal(fetchCalls, 0);

assert.equal(await dispatchFetch('/api/agent/run'), null);
assert.equal(await dispatchFetch('https://cdn.example/image.png'), null);
assert.equal(await dispatchFetch('/video.mp4', { headers: { range: 'bytes=0-10' } }), null);

console.log('PWA service worker runtime OK: lifecycle, offline navigation, shell cache and network-only bypass');
