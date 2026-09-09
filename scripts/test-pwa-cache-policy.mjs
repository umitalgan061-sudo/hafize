import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

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
// The shell cache version is bumped on every asset change, so pin the naming
// contract instead of one literal version: `<prefix>v<n>` with n >= 1.
const currentCacheVersion = Number(policy.CURRENT_CACHE.slice(`${policy.CACHE_PREFIX}v`.length));
assert.equal(policy.CURRENT_CACHE, `${policy.CACHE_PREFIX}v${currentCacheVersion}`);
assert.ok(Number.isInteger(currentCacheVersion) && currentCacheVersion >= 1);
assert.ok(Object.isFrozen(policy));
assert.ok(Object.isFrozen(policy.SHELL_ASSETS));
// The precache list grows with every shipped UI surface, so assert the rules it
// must obey rather than one frozen snapshot of its contents.
for (const asset of [
  '/',
  '/index.html',
  '/offline.html',
  '/styles.css',
  '/app.js',
  '/ui-shell.js',
  '/sw-policy.js',
  '/manifest.webmanifest'
]) {
  assert.ok(policy.SHELL_ASSETS.includes(asset), `${asset} must stay in the precached shell`);
}
assert.equal(new Set(policy.SHELL_ASSETS).size, policy.SHELL_ASSETS.length, 'shell assets must be unique');
for (const asset of policy.SHELL_ASSETS) {
  assert.equal(typeof asset, 'string');
  assert.ok(asset.startsWith('/'), `${asset} must be a same-origin absolute path`);
  assert.equal(asset.includes('..'), false, `${asset} must not traverse outside public/`);
}
assert.equal(policy.SHELL_ASSETS.some((path) => path.startsWith('/api/')), false);
// A precached path that does not exist makes service worker install reject and
// leaves the app without an offline shell, so every entry must resolve.
for (const asset of policy.SHELL_ASSETS) {
  const relative = asset === '/' ? 'index.html' : asset.slice(1);
  await readFile(join(ROOT, 'public', relative));
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

// Every superseded shell cache is evictable and only the current one survives,
// whatever version the shell has reached.
for (let version = 1; version < currentCacheVersion; version += 1) {
  assert.equal(policy.shouldDeleteCache(`${policy.CACHE_PREFIX}v${version}`), true);
}
assert.equal(policy.shouldDeleteCache(policy.CURRENT_CACHE), false);
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
