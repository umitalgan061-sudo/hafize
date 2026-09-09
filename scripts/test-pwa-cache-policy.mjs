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

// This suite owns the shell cache contract: every other suite asserts only the
// `hafize-shell-v<n>` shape, so shipping a new shell asset needs one version
// bump here instead of an edit in every feature suite.
assert.equal(policy.CACHE_PREFIX, 'hafize-shell-');
const currentVersion = /^hafize-shell-v(\d+)$/.exec(policy.CURRENT_CACHE);
assert.ok(currentVersion, 'shell cache must stay a monotonic hafize-shell-v<n> name');
const CURRENT_VERSION = Number(currentVersion[1]);
assert.ok(CURRENT_VERSION >= 18, 'shell cache version must never move backwards');
assert.ok(Object.isFrozen(policy));
assert.ok(Object.isFrozen(policy.SHELL_ASSETS));

// Core shell: the app must stay installable and openable offline without these.
for (const asset of ['/', '/index.html', '/offline.html', '/styles.css', '/app.js', '/ui-shell.js', '/sw-policy.js', '/manifest.webmanifest', '/hafize.jpeg']) {
  assert.ok(policy.SHELL_ASSETS.includes(asset), `${asset} must stay a precached shell asset`);
}
assert.equal(new Set(policy.SHELL_ASSETS).size, policy.SHELL_ASSETS.length, 'shell assets must not repeat');
assert.equal(policy.SHELL_ASSETS.some((path) => path.startsWith('/api/')), false);
assert.equal(policy.SHELL_ASSETS.every((path) => path.startsWith('/')), true, 'shell assets stay same-origin absolute paths');

// Drift guard: a page asset that ships without being precached silently breaks
// the offline shell, so every local script/style in index.html must be listed.
// `/auth.js` is deliberately excluded: the session flow is online-only.
const NON_SHELL_PAGE_ASSETS = new Set(['/auth.js']);
const indexSource = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
const pageAssets = [...indexSource.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]);
assert.ok(pageAssets.length >= 10, 'index.html asset scan must not silently match nothing');
for (const asset of pageAssets) {
  if (NON_SHELL_PAGE_ASSETS.has(asset)) {
    assert.equal(policy.SHELL_ASSETS.includes(asset), false, `${asset} is intentionally not precached`);
    continue;
  }
  assert.ok(policy.SHELL_ASSETS.includes(asset), `${asset} is used by index.html but missing from SHELL_ASSETS`);
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

// Every shipped predecessor is evicted; only the current version survives.
for (let version = 1; version < CURRENT_VERSION; version += 1) {
  assert.equal(policy.shouldDeleteCache(`hafize-shell-v${version}`), true, `hafize-shell-v${version} must be evicted`);
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
