import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { previousShellCacheNames, readShellCacheName } from './check-support.mjs';

const require = createRequire(import.meta.url);
const policy = require('../public/sw-policy.js');

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ORIGIN = 'https://hafize.example';

function request(path, options = {}) {
  const url = path.startsWith('http') ? path : new URL(path, ORIGIN).href;
  return {
    url,
    method: options.method ?? 'GET',
    mode: options.mode ?? 'same-origin',
    headers: options.headers ?? {}
  };
}

function headers(values = {}) {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)])
  );
  return {
    get(name) {
      return normalized.get(String(name).toLowerCase()) ?? null;
    }
  };
}

assert.equal(policy.CACHE_PREFIX, 'hafize-shell-');
assert.equal(policy.CURRENT_CACHE, readShellCacheName());
assert.ok(Object.isFrozen(policy));
assert.ok(Object.isFrozen(policy.SHELL_ASSETS));
// The shell list grows with every UI module, so assert the invariants instead of
// a snapshot: the core shell is always present, entries stay root-relative
// static paths, and nothing dynamic or credential-bearing is precached.
for (const core of [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/premium.css',
  '/app.js',
  '/ui-shell.js',
  '/sw-policy.js',
  '/manifest.webmanifest',
  '/hafize.jpeg'
]) {
  assert.ok(policy.SHELL_ASSETS.includes(core), `core shell asset missing: ${core}`);
}
assert.equal(new Set(policy.SHELL_ASSETS).size, policy.SHELL_ASSETS.length, 'shell assets must be unique');
for (const asset of policy.SHELL_ASSETS) {
  assert.match(asset, /^\/[\w./-]*$/, `shell asset must be a root-relative static path: ${asset}`);
  assert.equal(asset.includes('..'), false, `shell asset must not traverse: ${asset}`);
  assert.equal(asset.startsWith('/api/'), false, `API responses must never be precached: ${asset}`);
}

// Everything the shell HTML loads must survive offline. `/auth.js` is the one
// deliberate exception: the session flow always has to come from the network.
const NEVER_PRECACHED = new Set(['/auth.js']);
const shellHtml = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
const referenced = new Set([...shellHtml.matchAll(/(?:href|src)="(\/[^"?#]+)"/g)].map((match) => match[1]));
for (const asset of referenced) {
  if (NEVER_PRECACHED.has(asset)) {
    assert.equal(policy.SHELL_ASSETS.includes(asset), false, `${asset} must stay network-only`);
    continue;
  }
  assert.ok(policy.SHELL_ASSETS.includes(asset), `index.html asset missing from shell cache: ${asset}`);
}

for (const asset of policy.SHELL_ASSETS) {
  assert.equal(
    policy.classifyRequest(request(asset), ORIGIN),
    'shell',
    `${asset} should be an explicit shell asset`
  );
}

assert.equal(
  policy.classifyRequest(request('/styles.css?v=14'), ORIGIN),
  'shell',
  'query strings must not prevent shell matching'
);
assert.equal(
  policy.classifyRequest(request('/app.js?cache-bust=1'), ORIGIN),
  'shell'
);

assert.equal(
  policy.classifyRequest(request('/conversation/123', { mode: 'navigate' }), ORIGIN),
  'navigation'
);
assert.equal(
  policy.classifyRequest(request('/some-page', {
    headers: { Accept: 'text/html,application/xhtml+xml' }
  }), ORIGIN),
  'navigation'
);
assert.equal(
  policy.classifyRequest(request('/some-page', {
    headers: headers({ ACCEPT: 'text/html' })
  }), ORIGIN),
  'navigation'
);

const apiRequests = [
  '/api/models',
  '/api/agents',
  '/api/agent/run',
  '/api/tasks',
  '/api/private-looking-resource?token=do-not-cache'
];
for (const path of apiRequests) {
  assert.equal(
    policy.classifyRequest(request(path), ORIGIN),
    'network-only',
    `${path} must never be a shell-cache candidate`
  );
}
assert.equal(
  policy.classifyRequest(request('/api/agent/run', {
    mode: 'navigate',
    headers: { accept: 'text/html' }
  }), ORIGIN),
  'network-only',
  'API boundary wins over navigation hints'
);

assert.equal(
  policy.classifyRequest(request('/runtime-generated.json'), ORIGIN),
  'network-only',
  'unknown same-origin GETs stay network-only instead of growing the cache'
);
assert.equal(
  policy.classifyRequest(request('/hafize.jpeg', { method: 'POST' }), ORIGIN),
  'ignore'
);
assert.equal(
  policy.classifyRequest(request('/video.mp4', {
    headers: { Range: 'bytes=0-1023' }
  }), ORIGIN),
  'ignore',
  'range requests bypass the service worker cache policy'
);
assert.equal(
  policy.classifyRequest(request('https://cdn.example/image.png'), ORIGIN),
  'ignore',
  'cross-origin content is not cached by Hafize'
);
assert.equal(policy.classifyRequest(null, ORIGIN), 'ignore');
assert.equal(policy.classifyRequest(request('/'), ''), 'ignore');

assert.equal(policy.isSameOriginUrl('/styles.css', ORIGIN), true);
assert.equal(policy.isSameOriginUrl('https://hafize.example/app.js', ORIGIN), true);
assert.equal(policy.isSameOriginUrl('https://other.example/app.js', ORIGIN), false);
assert.equal(policy.isSameOriginUrl('not a valid absolute url', ORIGIN), true);
assert.equal(policy.isSameOriginUrl('/styles.css', ''), false);

assert.equal(policy.shouldDeleteCache('hafize-shell-v1'), true);
for (const stale of previousShellCacheNames(4)) {
  assert.equal(policy.shouldDeleteCache(stale), true);
}
assert.equal(policy.shouldDeleteCache(readShellCacheName()), false);
assert.equal(policy.shouldDeleteCache('other-app-cache-v1'), false);
assert.equal(policy.shouldDeleteCache('hafize-runtime-v1'), false);
assert.equal(policy.shouldDeleteCache(null), false);

const swSource = await readFile(join(ROOT, 'public', 'sw.js'), 'utf8');
assert.match(swSource, /importScripts\('\/sw-policy\.js'\)/);
assert.match(swSource, /classifyRequest\(event\.request, self\.location\.origin\)/);
assert.match(swSource, /shouldDeleteCache\(key\)/);
assert.match(swSource, /cache\.addAll\(SHELL_ASSETS\)/);
assert.match(swSource, /cache\.match\('\/offline\.html'\)/);
assert.doesNotMatch(swSource, /cache\.put\(/);
assert.doesNotMatch(swSource, /authorization/i);
assert.doesNotMatch(swSource, /bearer/i);

const offlineSource = await readFile(join(ROOT, 'public', 'offline.html'), 'utf8');
assert.match(offlineSource, /Şu anda çevrimdışısın/);
assert.match(offlineSource, /sunucu bağlantısı gerektirir/);
assert.match(offlineSource, /href="\/"/);
assert.doesNotMatch(offlineSource, /<script/i);
assert.doesNotMatch(offlineSource, /api[_-]?key/i);
assert.doesNotMatch(offlineSource, /token/i);
assert.doesNotMatch(offlineSource, /credential/i);

console.log('PWA cache policy OK: shell-only offline cache, API network-only, scoped cleanup and offline fallback');
